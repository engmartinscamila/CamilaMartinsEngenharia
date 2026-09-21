import { createClient } from 'supabase';
import ExcelJS from 'npm:exceljs@4.4.0';
import { Buffer } from 'node:buffer';

// Exportador NOVO: o exportador anterior permanece disponível para o acervo legado.
// Esta função não cria cronogramas, não aprova planos e não grava no banco.
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateText = (value: unknown) => String(value ?? '').slice(0, 10);
const date = (value: unknown): Date | null => {
  if (!value) return null;
  const text = dateText(value);
  const parsed = new Date(`${text}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error('O cronograma contém datas inválidas.');
  }
  return parsed;
};
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 86400000);
const countDays = (start: Date, end: Date, calendar: string) => {
  let count = 0;
  for (let current = start; current <= end; current = addDays(current, 1)) {
    if (calendar === 'calendar_days' || (current.getUTCDay() !== 0 && current.getUTCDay() !== 6)) count++;
  }
  return count;
};
const progress = (start: Date, end: Date, at: Date, calendar: string) => {
  if (at < start) return 0;
  if (at >= end) return 100;
  const total = countDays(start, end, calendar);
  if (!total) throw new Error('Período sem dias de trabalho.');
  return 100 * countDays(start, at, calendar) / total;
};
const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value);
const safe = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 45) || 'Obra';
const money = '"R$ "#,##0.00;[Red]("R$ "#,##0.00)';
const isPresent = (value: unknown) => value !== null && value !== undefined && value !== '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ generated: false, error: 'Método não permitido.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    const jwt = req.headers.get('Authorization');
    if (!url || !key || !jwt?.startsWith('Bearer ')) throw new Error('Sessão ou configuração ausente.');
    // Toda leitura ocorre com o JWT real e com as políticas RLS existentes.
    const db = createClient(url, key, { global: { headers: { Authorization: jwt } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: identityError } = await db.auth.getUser();
    if (identityError || !identity.user) throw new Error('Sessão inválida.');
    const { data: admin, error: adminError } = await db.rpc('is_portal_admin');
    if (adminError || admin !== true) throw new Error('Acesso administrativo necessário.');
    const input = await req.json().catch(() => ({}));
    const scheduleId = String(input.scheduleId ?? '');
    if (!uuid.test(scheduleId)) throw new Error('Identificador do cronograma inválido.');
    const { data: schedule, error: scheduleError } = await db.from('construction_schedules').select('*').eq('id', scheduleId).single();
    if (scheduleError || !schedule || schedule.activation_status !== 'approved' || Number(schedule.baseline_version) < 1 || !schedule.baseline_snapshot) {
      throw new Error('Exporte somente um cronograma completo com linha de base aprovada.');
    }
    const baseline = schedule.baseline_snapshot as Record<string, any>;
    if (!Array.isArray(baseline.activities) || !baseline.activities.length || !['weekdays', 'calendar_days'].includes(String(baseline.calendar))) {
      throw new Error('Linha de base incompleta.');
    }
    if (baseline.scope?.quote_id !== schedule.quote_record_id || baseline.scope?.contract_record_id !== schedule.contract_record_id) {
      throw new Error('A origem comercial da linha de base não coincide com o cronograma.');
    }
    const [{ data: project, error: projectError }, { data: current, error: itemError }] = await Promise.all([
      db.from('projetos').select('id,cliente_id,nome,numero_contrato,numero_orcamento,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra').eq('id', schedule.project_id).single(),
      db.from('construction_schedule_items').select('*').eq('schedule_id', scheduleId).order('display_order', { ascending: true }),
    ]);
    if (projectError || !project || itemError || !current || project.cliente_id !== schedule.client_id) throw new Error('Projeto e atividades indisponíveis ou inconsistentes.');
    const { data: client, error: clientError } = await db.from('clientes').select('id,nome').eq('id', schedule.client_id).single();
    if (clientError || !client || client.id !== project.cliente_id) throw new Error('Cliente vinculado não encontrado.');
    const currentMap = new Map(current.map((item: any) => [String(item.code), item]));
    if (current.length !== baseline.activities.length) throw new Error('Atividades divergem da linha de base.');
    const activities = baseline.activities.map((item: any) => {
      const live: any = currentMap.get(String(item.code));
      if (!live || Number(item.planned_cost) !== Number(live.planned_cost) || Number(item.weight_percent) !== Number(live.weight_percent) ||
          dateText(item.planned_start) !== dateText(live.planned_start) || dateText(item.planned_finish) !== dateText(live.planned_finish)) {
        throw new Error('Linha de base divergente: corrija a integridade antes de exportar.');
      }
      const start = date(item.planned_start), finish = date(item.planned_finish);
      const cost = numberOrNull(item.planned_cost);
      if (!start || !finish || finish < start || cost === null || !Number.isFinite(cost) || cost < 0) throw new Error('Datas ou custos de execução inválidos.');
      return { base: item, live, start, finish, cost, weight: Number(item.weight_percent) };
    });
    const totalCost = activities.reduce((total, item) => total + item.cost, 0);
    const totalWeight = activities.reduce((total, item) => total + item.weight, 0);
    if (totalCost <= 0 || Math.abs(totalWeight - 100) > 0.01) throw new Error('Pesos e custos da execução precisam estar completos.');
    const start = activities.reduce((earliest, item) => item.start < earliest ? item.start : earliest, activities[0].start);
    const finish = activities.reduce((latest, item) => item.finish > latest ? item.finish : latest, activities[0].finish);
    const reference = date(schedule.reference_date) ?? new Date();
    const calendar = String(baseline.calendar);
    const weeks: Date[] = [];
    for (let day = start, index = 0; day <= finish; day = addDays(day, 7), index++) {
      if (index > 520) throw new Error('Prazo superior a dez anos: revise os dados antes de exportar.');
      weeks.push(day);
    }
    if (weeks.length === 0 || weeks[weeks.length - 1] < finish) weeks.push(finish);

    const book = new ExcelJS.Workbook();
    book.creator = 'Camila Martins Engenharia';
    book.company = 'Camila Martins Engenharia';
    book.subject = 'Cronograma físico-financeiro — linha de base aprovada';
    book.calcProperties.fullCalcOnLoad = true;
    const navy = '08192B', gold = 'C39C54';
    function style(sheet: ExcelJS.Worksheet, width: number[] = []) {
      const head = sheet.getRow(1);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${navy}` } };
      head.alignment = { vertical: 'middle', wrapText: true };
      head.height = 32;
      sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
      width.forEach((size, index) => { sheet.getColumn(index + 1).width = size; });
    }
    const cadastro = book.addWorksheet('Cadastro');
    cadastro.addRow(['CAMiLA MARTINS ENGENHARIA — CRONOGRAMA APROVADO', 'Dado']);
    const address = [project.endereco_obra, project.numero_obra, project.complemento_obra, project.bairro_obra, project.cidade_obra, project.estado_obra].filter(Boolean).join(', ');
    const meta = [
      ['Cliente', client.nome], ['Obra', project.nome], ['Endereço da obra', address],
      ['Orçamento comercial', baseline.scope?.quote_number ?? project.numero_orcamento ?? ''],
      ['Contrato comercial', baseline.scope?.contract_number ?? project.numero_contrato ?? ''],
      ['Linha de base', Number(schedule.baseline_version)], ['Aprovada em', schedule.approved_at ? date(schedule.approved_at) : null],
      ['Data de referência', reference], ['Calendário', calendar], ['Início base', start], ['Fim base', finish],
      ['Orçamento da EXECUÇÃO (R$)', totalCost], ['Situação', 'APROVADO — não alterar a linha de base; edite somente atual/real'],
    ];
    meta.forEach((pair) => cadastro.addRow(pair));
    style(cadastro, [39, 78]);
    for (const index of [8, 9, 11, 12]) cadastro.getCell(index, 2).numFmt = 'dd/mm/yyyy';
    cadastro.getCell('B13').numFmt = money;
    cadastro.getCell('A17').value = 'Obs.: custos de obra não são honorários da engenharia; o realizado exige medições datadas.';
    cadastro.getCell('A18').value = 'Sem calendário de feriados persistido: dias úteis consideram segunda–sexta, sem feriados.';

    const cron = book.addWorksheet('Cronograma');
    cron.addRow(['ID', 'EAP', 'Etapa', 'Atividade', 'Responsável', 'Início base', 'Fim base', 'Duração (dias)', 'Predecessora', 'Início atual', 'Fim atual', '% previsto', '% real atual', 'Peso físico', 'Peso financeiro', 'Custo previsto obra', 'Custo real informado', 'Desvio (p.p.)', 'Status', 'Origem do custo', 'Serviço contratado']);
    style(cron, [11, 13, 19, 46, 23, 16, 16, 16, 15, 16, 16, 14, 14, 14, 16, 19, 20, 17, 18, 40, 20]);
    activities.forEach(({ base, live, start: begin, finish: end, cost, weight }, index) => {
      const r = index + 2;
      cron.addRow([base.code, base.eap ?? null, base.category, base.activity, live.responsible ?? null, begin, end,
        Number(base.planned_duration_days), base.predecessor_code ?? null, date(live.actual_start), date(live.actual_finish), null,
        numberOrNull(live.actual_progress), numberOrNull(base.physical_weight_percent), weight, cost,
        numberOrNull(live.actual_cost), null, live.status ?? 'Pendente', base.cost_source ?? '', base.source_service_code ?? '']);
      // O prazo planejado referencia a data e calendário do Cadastro, inclusive em Excel editável.
      cron.getCell(r, 12).value = { formula: `IF(OR(F${r}="",G${r}=""),"",IF(Cadastro!$B$9<F${r},0,IF(Cadastro!$B$9>=G${r},100,IF(Cadastro!$B$10="weekdays",NETWORKDAYS(F${r},Cadastro!$B$9)/MAX(1,NETWORKDAYS(F${r},G${r}))*100,(Cadastro!$B$9-F${r}+1)/(G${r}-F${r}+1)*100))))` };
      cron.getCell(r, 18).value = { formula: `IF(OR(L${r}="",M${r}=""),"",M${r}-L${r})` };
      for (const col of [6, 7, 10, 11]) cron.getCell(r, col).numFmt = 'dd/mm/yyyy';
      for (const col of [12, 13, 14, 15, 18]) cron.getCell(r, col).numFmt = '0.00"%"';
      for (const col of [16, 17]) cron.getCell(r, col).numFmt = money;
      cron.getCell(r, 13).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 100], showErrorMessage: true, error: 'Percentual entre 0 e 100.' };
    });
    cron.autoFilter = { from: 'A1', to: `U${activities.length + 1}` };
    const last = activities.length + 1;

    const summary = book.addWorksheet('Indicadores');
    summary.addRow(['Indicador', 'Valor', 'Interpretação']);
    summary.addRows([
      ['Custo total da execução', { formula: `SUM(Cronograma!P2:P${last})` }, 'Não inclui honorários comerciais'],
      ['Avanço previsto ponderado (%)', { formula: `SUMPRODUCT(Cronograma!L2:L${last},Cronograma!O2:O${last})/100` }, 'Na data de referência'],
      ['Avanço real ponderado (%)', { formula: `IF(COUNT(Cronograma!M2:M${last})<COUNT(Cronograma!O2:O${last}),"",SUMPRODUCT(Cronograma!M2:M${last},Cronograma!O2:O${last})/100)` }, 'Situação atual, não série histórica'],
      ['Valor planejado no corte', { formula: `SUMPRODUCT(Cronograma!L2:L${last},Cronograma!P2:P${last})/100` }, 'Execução planejada acumulada'],
      ['Valor agregado por avanço', { formula: `IF(COUNT(Cronograma!M2:M${last})<COUNT(Cronograma!O2:O${last}),"",SUMPRODUCT(Cronograma!M2:M${last},Cronograma!P2:P${last})/100)` }, 'Avanço medido vezes custo de obra, não desembolso'],
      ['Custo real registrado', { formula: `IF(COUNT(Cronograma!Q2:Q${last})<COUNT(Cronograma!P2:P${last}),"",SUM(Cronograma!Q2:Q${last}))` }, 'Em branco até custos reais completos'],
      ['Desvio físico ponderado (p.p.)', { formula: 'IF(OR(B3="",B4=""),"",B4-B3)' }, 'Real menos planejado'],
      ['Desvio de custo (R$)', { formula: 'IF(OR(B6="",B7=""),"",B6-B7)' }, 'Valor agregado menos custo real'],
      ['SPI (indicativo)', { formula: 'IF(OR(B5="",B5=0,B6=""),"",B6/B5)' }, 'EV / PV, condicionado a dados completos'],
      ['CPI (indicativo)', { formula: 'IF(OR(B6="",B7="",B7=0),"",B6/B7)' }, 'EV / AC, condicionado a dados completos'],
    ]);
    style(summary, [39, 24, 75]);
    for (const r of [2, 5, 6, 7, 9]) summary.getCell(r, 2).numFmt = money;

    const curve = book.addWorksheet('Curva S');
    curve.addRow(['Semana / data', 'Planejado ponderado (%)', 'Custo planejado acumulado (R$)', 'Real histórico (%)', 'Custo real histórico (R$)']);
    style(curve, [20, 30, 36, 26, 29]);
    for (const [index, at] of weeks.entries()) {
      const plannedCost = activities.reduce((total, item) => total + item.cost * progress(item.start, item.finish, at, calendar) / 100, 0);
      curve.addRow([at, plannedCost / totalCost * 100, plannedCost, null, null]);
      curve.getCell(index + 2, 1).numFmt = 'dd/mm/yyyy';
      curve.getCell(index + 2, 3).numFmt = money;
    }
    curve.getCell(weeks.length + 4, 1).value = 'Série real histórica indisponível: registrar medições datadas antes de desenhar a curva realizada.';
    curve.getCell(weeks.length + 5, 1).value = 'O realizado ATUAL está na aba Cronograma; não interpolar retrospectivamente.';
    curve.getCell(weeks.length + 6, 1).value = 'Curva planejada = retrato na emissão; reexportar para atualizar após mudanças no planejamento.';

    const gantt = book.addWorksheet('Gantt');
    gantt.addRow(['Código', 'Atividade', 'Peso financeiro (%)', ...weeks]);
    style(gantt, [12, 47, 22]);
    weeks.forEach((at, index) => { gantt.getCell(1, index + 4).value = at; gantt.getCell(1, index + 4).numFmt = 'dd/mm/yy'; gantt.getColumn(index + 4).width = 12; });
    activities.forEach(({ base }, index) => {
      const row = index + 2, source = index + 2;
      gantt.getCell(row, 1).value = { formula: `Cronograma!A${source}` };
      gantt.getCell(row, 2).value = { formula: `Cronograma!D${source}` };
      gantt.getCell(row, 3).value = { formula: `Cronograma!O${source}` };
      weeks.forEach((_at, i) => {
        const col = i + 4, cell = gantt.getCell(row, col), letter = gantt.getColumn(col).letter;
        cell.value = { formula: `IF(AND(${letter}$1+6>=Cronograma!$F${source},${letter}$1<=Cronograma!$G${source}),"■","")` };
        cell.font = { bold: true, color: { argb: `FF${gold}` } };
        cell.alignment = { horizontal: 'center' };
      });
    });
    const milestones = book.addWorksheet('Marcos');
    milestones.addRow(['Marco', 'Descrição', 'Atividade vinculada', 'Data base', 'Data atual', 'Aprovador', 'Status', 'Observações']);
    milestones.addRow(['REFERÊNCIA', 'Término calculado da linha de base (validar marcos expressos no contrato)', null, finish, null, null, 'A conferir', 'Nenhum marco ou aceite foi presumido.']);
    style(milestones, [20, 66, 22, 17, 17, 24, 19, 65]);
    milestones.getCell('D2').numFmt = 'dd/mm/yyyy';

    const dashboard = book.addWorksheet('Export Dashboard');
    dashboard.addRow(['Código da obra', 'Indicador', 'Valor', 'Unidade', 'Origem', 'Atualização']);
    dashboard.addRows([
      [schedule.project_id, 'Avanço previsto ponderado', { formula: 'Indicadores!B3' }, '%', 'Cronograma aprovado', reference],
      [schedule.project_id, 'Avanço real ponderado', { formula: 'Indicadores!B4' }, '%', 'Registro atual, não histórico', reference],
      [schedule.project_id, 'Orçamento da execução', { formula: 'Indicadores!B2' }, 'R$', 'Cronograma aprovado', reference],
      [schedule.project_id, 'Custo real registrado', { formula: 'Indicadores!B7' }, 'R$', 'Registro atual', reference],
    ]);
    style(dashboard, [40, 31, 24, 14, 38, 18]);
    for (let r = 2; r <= 5; r++) dashboard.getCell(r, 6).numFmt = 'dd/mm/yyyy';

    const readme = book.addWorksheet('Leia-me');
    readme.addRow(['INSTRUÇÕES — CAMILA MARTINS ENGENHARIA', 'Regra']);
    readme.addRows([
      ['Origem', 'Extraído de linha de base aprovada, sem criar ou alterar dados no servidor.'],
      ['Planejamento', 'Datas, pesos e custos da linha de base refletem a versão aprovada; alterações exigem aditivo/versão.'],
      ['Realizado', 'Campos atuais são retrato do banco no momento da exportação. Alterar o XLSX não altera o portal.'],
      ['Curva S', 'Planejado cobre todo o prazo. Série REAL histórica fica vazia até existir banco de medições datadas.'],
      ['Dias úteis', 'Segunda a sexta, sem feriados: feriados ainda não estão armazenados na versão atual.'],
      ['Custos', 'Nunca usar preço dos honorários como orçamento de execução. Em branco NÃO representa custo zero.'],
      ['Atualização', 'Reexportar após atualizar dados no portal; planilha é cópia editável, sem sincronização automática.'],
      ['Privacidade', 'A função verifica sessão administrativa; não distribuir dados dos clientes sem autorização.'],
    ]);
    style(readme, [34, 125]);
    const bytes = await book.xlsx.writeBuffer();
    const contentBase64 = Buffer.from(bytes as ArrayBuffer).toString('base64');
    return reply({ generated: true, fileName: `Cronograma-${safe(project.nome)}-base-v${schedule.baseline_version}.xlsx`, contentBase64, scheduleId, baselineVersion: schedule.baseline_version, itemCount: activities.length });
  } catch (error) {
    // Não divulgar mensagens de banco contendo registros ou dados pessoais.
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o arquivo Excel.';
    return reply({ generated: false, error: message }, 400);
  }
});
