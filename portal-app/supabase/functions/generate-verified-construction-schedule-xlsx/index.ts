import { createClient } from 'supabase';
import ExcelJS from 'npm:exceljs@4.4.0';
import { Buffer } from 'node:buffer';
import { renderScheduleCurveChart } from './curve-chart.ts';

// Exportador independente do legado: nunca cria, aprova nem altera cronogramas.
const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {...cors, 'Content-Type': 'application/json; charset=utf-8'},
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
const countDays = (start: Date, end: Date, calendar: string, holidays: ReadonlySet<string> = new Set<string>()) => {
  let count = 0;
  for (let current = start; current <= end; current = addDays(current, 1)) {
    if (calendar === 'calendar_days' || (
      current.getUTCDay() !== 0 && current.getUTCDay() !== 6 && !holidays.has(dateText(current.toISOString()))
    )) count++;
  }
  return count;
};
const progress = (start: Date, end: Date, at: Date, calendar: string, holidays: ReadonlySet<string> = new Set<string>()) => {
  if (at < start) return 0;
  if (at >= end) return 100;
  const total = countDays(start, end, calendar, holidays);
  if (!total) throw new Error('Período sem dias de trabalho.');
  return 100 * countDays(start, at, calendar, holidays) / total;
};
const numberOrNull = (value: unknown) => value === null || value === undefined || value === '' ? null : Number(value);
const safe = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 45) || 'Obra';
const money = '"R$ "#,##0.00;[Red]("R$ "#,##0.00)';
type MeasurementEvent = {item_id: string; measured_on: string; recorded_at: string; id: string; actual_progress: number; actual_construction_cost: number | null};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (req.method !== 'POST') return reply({generated: false, error: 'Método não permitido.'}, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    const jwt = req.headers.get('Authorization');
    if (!url || !key || !jwt?.startsWith('Bearer ')) throw new Error('Sessão ou configuração ausente.');
    // Toda leitura com JWT do usuário e RLS: sem service role.
    const db = createClient(url, key, {global: {headers: {Authorization: jwt}}, auth: {persistSession: false, autoRefreshToken: false}});
    const {data: identity, error: identityError} = await db.auth.getUser();
    if (identityError || !identity.user) throw new Error('Sessão inválida.');
    const {data: admin, error: adminError} = await db.rpc('is_portal_admin');
    if (adminError || admin !== true) throw new Error('Acesso administrativo necessário.');
    const input = await req.json().catch(() => ({}));
    const scheduleId = String(input.scheduleId ?? '');
    if (!uuid.test(scheduleId)) throw new Error('Identificador do cronograma inválido.');
    const {data: schedule, error: scheduleError} = await db.from('construction_schedules').select('*').eq('id', scheduleId).single();
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
    const [{data: project, error: projectError}, {data: current, error: itemError}, measurementCount,
      holidayResponse, archiveResponse] = await Promise.all([
      db.from('projetos').select('id,cliente_id,nome,numero_contrato,numero_orcamento,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra').eq('id', schedule.project_id).single(),
      db.from('construction_schedule_items').select('*').eq('schedule_id', scheduleId).order('display_order', {ascending: true}),
      db.from('construction_schedule_measurements').select('id', {count: 'exact', head: true}).eq('schedule_id', scheduleId),
      db.from('construction_schedule_holidays').select('holiday_date').eq('schedule_id', scheduleId).order('holiday_date').limit(367),
      db.from('construction_schedule_baseline_versions').select('baseline_snapshot,holiday_dates')
        .eq('schedule_id', scheduleId).eq('baseline_version', schedule.baseline_version).single(),
    ]);
    if (projectError || !project || itemError || !current || project.cliente_id !== schedule.client_id) throw new Error('Projeto e atividades indisponíveis ou inconsistentes.');
    if (holidayResponse.error || !holidayResponse.data || holidayResponse.data.length > 366 || archiveResponse.error || !archiveResponse.data) {
      throw new Error('Calendário de feriados ou versão aprovada indisponível para conferir.');
    }
    const holidayDates = holidayResponse.data.map((row) => String(row.holiday_date));
    if (JSON.stringify(holidayDates) !== JSON.stringify(archiveResponse.data.holiday_dates) ||
      JSON.stringify(archiveResponse.data.baseline_snapshot) !== JSON.stringify(schedule.baseline_snapshot)) {
      throw new Error('Feriados e linha de base atuais divergem do arquivo aprovado.');
    }
    const holidays = new Set<string>(holidayDates);
    if (measurementCount.error || measurementCount.count === null) throw new Error('O histórico de medições deve estar disponível antes de exportar.');
    if (measurementCount.count > 1000) throw new Error('O histórico tem mais de 1.000 medições; paginação integral necessária antes de exportar.');
    const {data: measurements, error: measurementError} = await db.from('construction_schedule_measurements')
      .select('id,item_id,measured_on,recorded_at,actual_progress,actual_construction_cost')
      .eq('schedule_id', scheduleId).order('measured_on').order('recorded_at').order('id').limit(1000);
    if (measurementError || !measurements || measurements.length !== measurementCount.count) throw new Error('Histórico de medições incompleto: não exportar dados parciais.');
    const events = measurements as MeasurementEvent[];
    const {data: client, error: clientError} = await db.from('clientes').select('id,nome').eq('id', schedule.client_id).single();
    if (clientError || !client || client.id !== project.cliente_id) throw new Error('Cliente vinculado não encontrado.');
    const currentMap = new Map(current.map((item: any) => [String(item.code), item]));
    if (current.length !== baseline.activities.length) throw new Error('Atividades divergem da linha de base.');
    const activities = baseline.activities.map((item: any) => {
      const live: any = currentMap.get(String(item.code));
      if (!live || Number(item.planned_cost) !== Number(live.planned_cost) || Number(item.weight_percent) !== Number(live.weight_percent) ||
        dateText(item.planned_start) !== dateText(live.planned_start) || dateText(item.planned_finish) !== dateText(live.planned_finish)) {
        throw new Error('Linha de base divergente: corrija a integridade antes de exportar.');
      }
      const begin = date(item.planned_start), finish = date(item.planned_finish);
      const cost = numberOrNull(item.planned_cost);
      if (!begin || !finish || finish < begin || cost === null || !Number.isFinite(cost) || cost < 0) throw new Error('Datas ou custos de execução inválidos.');
      return {base: item, live, start: begin, finish, cost, weight: Number(item.weight_percent)};
    });
    const ids = new Set(activities.map(({live}: any) => String(live.id)));
    if (events.some((event) => !ids.has(String(event.item_id)))) throw new Error('Medição com atividade alheia à linha de base.');
    const totalCost = activities.reduce((total: number, item: any) => total + item.cost, 0);
    const totalWeight = activities.reduce((total: number, item: any) => total + item.weight, 0);
    if (totalCost <= 0 || Math.abs(totalWeight - 100) > 0.01) throw new Error('Pesos e custos da execução precisam estar completos.');
    const start: Date = activities.reduce((earliest: Date, item: any) => item.start < earliest ? item.start : earliest, activities[0].start);
    const finish: Date = activities.reduce((latest: Date, item: any) => item.finish > latest ? item.finish : latest, activities[0].finish);
    const reference = date(schedule.reference_date) ?? new Date();
    const calendar = String(baseline.calendar);
    const lastMeasurement = events.length ? date(events[events.length - 1]?.measured_on) : null;
    const end = lastMeasurement && lastMeasurement > finish ? lastMeasurement : finish;
    const weeks: Date[] = [];
    for (let day = start, index = 0; day <= end; day = addDays(day, 7), index++) {
      if (index > 520) throw new Error('Prazo superior a dez anos: revise os dados antes de exportar.');
      weeks.push(day);
    }
    if (weeks.length === 0 || weeks[weeks.length - 1] < finish) weeks.push(finish);
    if (weeks[weeks.length - 1] < end) weeks.push(end);
    weeks.sort((a, b) => a.getTime() - b.getTime());
    const timeline = [...new Map(weeks.map((day) => [dateText(day.toISOString()), day])).values()];
    const state = new Map<string, {progress: number; cost: number | null}>();
    let eventIndex = 0;
    const series = timeline.map((at) => {
      const atText = dateText(at.toISOString());
      while (eventIndex < events.length && events[eventIndex]!.measured_on <= atText) {
        const event = events[eventIndex++]!;
        const prior = state.get(event.item_id);
        state.set(event.item_id, {progress: Number(event.actual_progress),
          cost: event.actual_construction_cost === null ? prior?.cost ?? null : Number(event.actual_construction_cost)});
      }
      const plannedCost = activities.reduce((total: number, item: any) => total + item.cost * progress(item.start, item.finish, at, calendar, holidays) / 100, 0);
      const completeProgress = activities.every(({live}: any) => state.has(String(live.id)));
      const completeCost = activities.every(({live}: any) => state.get(String(live.id))?.cost !== null && state.get(String(live.id))?.cost !== undefined);
      const measuredPercent = completeProgress ? activities.reduce((total: number, item: any) =>
        total + item.weight * (state.get(String(item.live.id))?.progress ?? 0) / 100, 0) : null;
      const measuredCost = completeCost ? activities.reduce((total: number, item: any) => total + (state.get(String(item.live.id))?.cost ?? 0), 0) : null;
      const physicalWeights = activities.every(({base}: any) => numberOrNull(base.physical_weight_percent) !== null);
      const physicalPlanned = physicalWeights ? activities.reduce((total: number, item: any) =>
        total + Number(item.base.physical_weight_percent) * progress(item.start, item.finish, at, calendar, holidays) / 100, 0) : null;
      const physicalMeasured = physicalWeights && completeProgress ? activities.reduce((total: number, item: any) =>
        total + Number(item.base.physical_weight_percent) * (state.get(String(item.live.id))?.progress ?? 0) / 100, 0) : null;
      return {at, plannedCost, planned: plannedCost / totalCost * 100, actual: measuredPercent, actualCost: measuredCost,
        physicalPlanned, physicalActual: physicalMeasured};
    });
    const latestByItem = new Map<string, {progress: number; cost: number | null}>();
    for (const event of events) {
      if (event.measured_on > dateText(reference.toISOString())) break;
      const prior = latestByItem.get(event.item_id);
      latestByItem.set(event.item_id, {progress: Number(event.actual_progress),
        cost: event.actual_construction_cost === null ? prior?.cost ?? null : Number(event.actual_construction_cost)});
    }
    const book = new ExcelJS.Workbook();
    book.creator = 'Camila Martins Engenharia';
    book.company = 'Camila Martins Engenharia';
    book.subject = 'Cronograma físico-financeiro — linha de base aprovada';
    book.calcProperties.fullCalcOnLoad = true;
    const navy = '08192B', gold = 'C39C54';
    function style(sheet: ExcelJS.Worksheet, width: number[] = []) {
      const head = sheet.getRow(1);
      head.font = {bold: true, color: {argb: 'FFFFFFFF'}};
      head.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: `FF${navy}`}};
      head.alignment = {vertical: 'middle', wrapText: true};
      head.height = 32;
      sheet.views = [{state: 'frozen', ySplit: 1, showGridLines: false}];
      width.forEach((size, index) => {sheet.getColumn(index + 1).width = size;});
    }
    const cadastro = book.addWorksheet('Cadastro');
    cadastro.addRow(['CAMILA MARTINS ENGENHARIA — CRONOGRAMA APROVADO', 'Dado']);
    const address = [project.endereco_obra, project.numero_obra, project.complemento_obra, project.bairro_obra, project.cidade_obra, project.estado_obra].filter(Boolean).join(', ');
    const meta = [
      ['Cliente', client.nome], ['Obra', project.nome], ['Endereço da obra', address],
      ['Orçamento comercial', baseline.scope?.quote_number ?? project.numero_orcamento ?? ''],
      ['Contrato comercial', baseline.scope?.contract_number ?? project.numero_contrato ?? ''],
      ['Linha de base', Number(schedule.baseline_version)], ['Aprovada em', schedule.approved_at ? date(schedule.approved_at) : null],
      ['Data de referência', reference], ['Calendário', calendar], ['Início base', start], ['Fim base', finish],
      ['Orçamento da EXECUÇÃO (R$)', totalCost], ['Situação', 'APROVADO — linha de base e feriados congelados'],
    ];
    meta.forEach((pair) => cadastro.addRow(pair));
    style(cadastro, [39, 78]);
    for (const index of [8, 9, 11, 12]) cadastro.getCell(index, 2).numFmt = 'dd/mm/yyyy';
    cadastro.getCell('B13').numFmt = money;
    cadastro.getCell('A17').value = 'Custos da obra não são honorários; realizado exige medições datadas e documentos comprovantes.';
    cadastro.getCell('A18').value = 'Feriados da obra congelados na aprovação: consulte a aba Feriados.';
    const holidaysSheet = book.addWorksheet('Feriados');
    holidaysSheet.addRow(['Data não útil conferida para a obra', 'Origem e regra']);
    for (const holiday of holidayDates) {
      const holidayDay = date(holiday);
      if (!holidayDay) throw new Error('Feriado inválido no calendário aprovado.');
      holidaysSheet.addRow([holidayDay, 'Data informada e conferida pela administradora']);
      holidaysSheet.getCell(holidaysSheet.rowCount, 1).numFmt = 'dd/mm/yyyy';
    }
    if (!holidayDates.length) holidaysSheet.addRow([null, 'Nenhum feriado informado e aprovado para a obra.']);
    style(holidaysSheet, [37, 70]);
    const holidayRange = `Feriados!$A$2:$A$${Math.max(2, holidayDates.length + 1)}`;
    const cron = book.addWorksheet('Cronograma');
    cron.addRow(['ID', 'EAP', 'Etapa', 'Atividade', 'Responsável', 'Início base', 'Fim base', 'Duração (dias)', 'Predecessora', 'Início atual', 'Fim atual', '% previsto', '% real atual', 'Peso físico', 'Peso financeiro', 'Custo previsto obra', 'Custo real informado', 'Desvio (p.p.)', 'Status', 'Origem do custo', 'Serviço contratado']);
    style(cron, [11, 13, 19, 46, 23, 16, 16, 16, 15, 16, 16, 14, 14, 14, 16, 19, 20, 17, 18, 40, 20]);
    activities.forEach(({base, live, start: begin, finish: endDay, cost, weight}: any, index: number) => {
      const r = index + 2;
      const known = latestByItem.get(String(live.id));
      cron.addRow([base.code, base.eap ?? null, base.category, base.activity, live.responsible ?? null, begin, endDay,
        Number(base.planned_duration_days), base.predecessor_code ?? null, date(live.actual_start), date(live.actual_finish), null,
        known?.progress ?? null, numberOrNull(base.physical_weight_percent), weight, cost,
        known?.cost ?? null, null, live.status ?? 'Pendente', base.cost_source ?? '', base.source_service_code ?? '']);
      cron.getCell(r, 12).value = {formula: `IF(OR(F${r}="",G${r}=""),"",IF(Cadastro!$B$9<F${r},0,IF(Cadastro!$B$9>=G${r},100,IF(Cadastro!$B$10="weekdays",NETWORKDAYS(F${r},Cadastro!$B$9,${holidayRange})/MAX(1,NETWORKDAYS(F${r},G${r},${holidayRange}))*100,(Cadastro!$B$9-F${r}+1)/(G${r}-F${r}+1)*100))))`};
      cron.getCell(r, 18).value = {formula: `IF(OR(L${r}="",M${r}=""),"",M${r}-L${r})`};
      for (const col of [6, 7, 10, 11]) cron.getCell(r, col).numFmt = 'dd/mm/yyyy';
      for (const col of [12, 13, 14, 15, 18]) cron.getCell(r, col).numFmt = '0.00"%"';
      for (const col of [16, 17]) cron.getCell(r, col).numFmt = money;
      cron.getCell(r, 13).dataValidation = {type: 'decimal', operator: 'between', formulae: [0, 100], showErrorMessage: true, error: 'Percentual entre 0 e 100.'};
    });
    cron.autoFilter = {from: 'A1', to: `U${activities.length + 1}`};
    const last = activities.length + 1;
    const summary = book.addWorksheet('Indicadores');
    summary.addRow(['Indicador', 'Valor', 'Interpretação']);
    summary.addRows([
      ['Custo total da execução', {formula: `SUM(Cronograma!P2:P${last})`}, 'Não inclui honorários comerciais'],
      ['Avanço previsto ponderado (%)', {formula: `SUMPRODUCT(Cronograma!L2:L${last},Cronograma!O2:O${last})/100`}, 'Na data de referência'],
      ['Avanço real ponderado (%)', {formula: `IF(COUNT(Cronograma!M2:M${last})<COUNT(Cronograma!O2:O${last}),"",SUMPRODUCT(Cronograma!M2:M${last},Cronograma!O2:O${last})/100)`}, 'Medido até data de referência, não retroprojeção'],
      ['Valor planejado no corte', {formula: `SUMPRODUCT(Cronograma!L2:L${last},Cronograma!P2:P${last})/100`}, 'Execução planejada acumulada'],
      ['Valor agregado por avanço', {formula: `IF(COUNT(Cronograma!M2:M${last})<COUNT(Cronograma!O2:O${last}),"",SUMPRODUCT(Cronograma!M2:M${last},Cronograma!P2:P${last})/100)`}, 'Avanço medido vezes custo de obra, não desembolso'],
      ['Custo real registrado', {formula: `IF(COUNT(Cronograma!Q2:Q${last})<COUNT(Cronograma!P2:P${last}),"",SUM(Cronograma!Q2:Q${last}))`}, 'Em branco até custos reais completos'],
      ['Desvio de avanço ponderado (p.p.)', {formula: 'IF(OR(B3="",B4=""),"",B4-B3)'}, 'Real menos planejado'],
      ['Desvio de custo (R$)', {formula: 'IF(OR(B6="",B7=""),"",B6-B7)'}, 'Valor agregado menos custo real'],
      ['SPI (indicativo)', {formula: 'IF(OR(B5="",B5=0,B6=""),"",B6/B5)'}, 'EV / PV, condicionado a dados completos'],
      ['CPI (indicativo)', {formula: 'IF(OR(B6="",B7="",B7=0),"",B6/B7)'}, 'EV / AC, condicionado a dados completos'],
    ]);
    style(summary, [39, 24, 75]);
    for (const row of [2, 5, 6, 7, 9]) summary.getCell(row, 2).numFmt = money;
    const curve = book.addWorksheet('Curva S');
    curve.addRow(['Semana / data', 'Planejado ponderado (%)', 'Custo planejado acumulado (R$)', 'Real histórico (%)', 'Custo real histórico (R$)', 'Físico previsto (%)', 'Físico realizado (%)']);
    style(curve, [20, 30, 36, 26, 29, 24, 24]);
    for (const [index, point] of series.entries()) {
      curve.addRow([point.at, point.planned, point.plannedCost, point.actual, point.actualCost, point.physicalPlanned, point.physicalActual]);
      curve.getCell(index + 2, 1).numFmt = 'dd/mm/yyyy';
      for (const col of [3, 5]) curve.getCell(index + 2, col).numFmt = money;
      for (const col of [2, 4, 6, 7]) curve.getCell(index + 2, col).numFmt = '0.00"%"';
    }
    curve.getCell(series.length + 4, 1).value = 'Real histórico permanece em branco até existir medição datada de TODAS as atividades.';
    curve.getCell(series.length + 5, 1).value = 'O gráfico é imagem do momento da emissão; após editar a planilha, reextraia para atualizar o gráfico.';
    curve.getCell(series.length + 6, 1).value = 'Legenda: dourado = planejado; azul marinho = realizado efetivamente medido.';
    const chartPng = renderScheduleCurveChart(series.map((point) => ({planned: point.planned, actual: point.actual})));
    const imageId = book.addImage({base64: chartPng, extension: 'png'});
    curve.addImage(imageId, {tl: {col: 8, row: 1}, ext: {width: 960, height: 380}});
    const gantt = book.addWorksheet('Gantt');
    gantt.addRow(['Código', 'Atividade', 'Peso financeiro (%)', ...timeline]);
    style(gantt, [12, 47, 22]);
    timeline.forEach((at, index) => {gantt.getCell(1, index + 4).value = at; gantt.getCell(1, index + 4).numFmt = 'dd/mm/yy'; gantt.getColumn(index + 4).width = 12;});
    activities.forEach(({base}: any, index: number) => {
      const row = index + 2, source = index + 2;
      gantt.getCell(row, 1).value = {formula: `Cronograma!A${source}`};
      gantt.getCell(row, 2).value = {formula: `Cronograma!D${source}`};
      gantt.getCell(row, 3).value = {formula: `Cronograma!O${source}`};
      timeline.forEach((_at, i) => {
        const col = i + 4, cell = gantt.getCell(row, col), letter = gantt.getColumn(col).letter;
        cell.value = {formula: `IF(AND(${letter}$1+6>=Cronograma!$F${source},${letter}$1<=Cronograma!$G${source}),"■","")`};
        cell.font = {bold: true, color: {argb: `FF${gold}`}};
        cell.alignment = {horizontal: 'center'};
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
      [schedule.project_id, 'Avanço previsto ponderado', {formula: 'Indicadores!B3'}, '%', 'Cronograma aprovado', reference],
      [schedule.project_id, 'Avanço real ponderado', {formula: 'Indicadores!B4'}, '%', 'Registro medido até o corte', reference],
      [schedule.project_id, 'Orçamento da execução', {formula: 'Indicadores!B2'}, 'R$', 'Cronograma aprovado', reference],
      [schedule.project_id, 'Custo real registrado', {formula: 'Indicadores!B7'}, 'R$', 'Medições datadas', reference],
    ]);
    style(dashboard, [40, 31, 24, 14, 38, 18]);
    for (let row = 2; row <= 5; row++) dashboard.getCell(row, 6).numFmt = 'dd/mm/yyyy';
    const readme = book.addWorksheet('Leia-me');
    readme.addRow(['INSTRUÇÕES — CAMILA MARTINS ENGENHARIA', 'Regra']);
    readme.addRows([
      ['Origem', 'Extraído de linha de base aprovada, sem criar ou alterar dados no servidor.'],
      ['Planejamento', 'Datas, pesos e custos da linha de base refletem a versão aprovada; alterações exigem aditivo/versão.'],
      ['Realizado', 'Somente medições datadas. Valores ausentes são desconhecidos e ficam em branco, nunca 0 automático.'],
      ['Curva S', 'Gráfico visual e dados planejados cobrem todo o prazo; real só existe após medições de todas as atividades.'],
      ['Dias úteis', 'Segunda a sexta, excluindo apenas as datas conferidas na aba Feriados. Dias corridos incluem essas datas.'],
      ['Custos', 'Nunca usar honorários como orçamento de execução. Em branco NÃO representa custo zero.'],
      ['Atualização', 'A planilha é cópia editável, não sincroniza com o portal; o gráfico embutido é uma imagem e não se recalcula após editar células.'],
      ['Privacidade', 'A função verifica sessão administrativa; não distribuir dados do cliente sem autorização.'],
    ]);
    style(readme, [34, 125]);
    const bytes = await book.xlsx.writeBuffer();
    const contentBase64 = Buffer.from(bytes as ArrayBuffer).toString('base64');
    return reply({generated: true, fileName: `Cronograma-${safe(project.nome)}-base-v${schedule.baseline_version}.xlsx`, contentBase64, scheduleId, baselineVersion: schedule.baseline_version, itemCount: activities.length});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o arquivo Excel.';
    return reply({generated: false, error: message}, 400);
  }
});
