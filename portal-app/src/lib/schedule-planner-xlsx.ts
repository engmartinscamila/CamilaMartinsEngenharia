/* Gera, no navegador, o Excel completo do planejador de cronograma.
 * Planilhas: Resumo (indicadores + gráficos), Cronograma, Gantt, Curva S,
 * Desembolso mensal, Caminho crítico e Calendário. Nenhum dado sai do navegador. */
import { Platform } from 'react-native';

import {
  calendarLabel, formatBr, nationalHolidays,
  type PlannerProject, type PlannerResult,
} from '@/lib/schedule-planner';

const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const NAVY = '0F2238', NAVY_SOFT = 'E7ECF3', GOLD = 'B89A63', RED = 'B42318', GREEN = '2C7655', GRID = 'D5DADF', INK = '102131';

let loader: Promise<any> | null = null;
function loadExcelJs(): Promise<any> {
  const w = globalThis as any;
  if (w.ExcelJS) return Promise.resolve(w.ExcelJS);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = EXCELJS_URL;
      script.async = true;
      script.onload = () => (w.ExcelJS ? resolve(w.ExcelJS) : reject(new Error('Biblioteca do Excel indisponível.')));
      script.onerror = () => { loader = null; reject(new Error('Não foi possível carregar o gerador de Excel. Verifique a internet e tente de novo.')); };
      document.head.appendChild(script);
    });
  }
  return loader;
}

const money = 'R$ #,##0.00';
const pct = '0.0"%"';
const dateFmt = 'dd/mm/yyyy';
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fill = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: GRID } };
const box = { top: thin, bottom: thin, left: thin, right: thin };

/* ---------- gráficos em imagem (canvas) ---------- */
function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, width, height);
  g.font = '14px "Century Gothic", Arial, sans-serif';
  return { c, g };
}

function curveImage(result: PlannerResult) {
  const W = 1000, H = 460, L = 70, R = 30, T = 50, B = 70;
  const { c, g } = canvas(W, H);
  const pts = result.curve;
  const t0 = d(result.start).getTime(), t1 = Math.max(t0 + 1, d(result.finish).getTime());
  const x = (iso: string) => L + (d(iso).getTime() - t0) / (t1 - t0) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  g.fillStyle = `#${NAVY}`; g.font = 'bold 20px "Century Gothic", Arial, sans-serif';
  g.fillText('Curva S — avanço físico acumulado', L, 30);
  g.font = '13px "Century Gothic", Arial, sans-serif';
  for (let v = 0; v <= 100; v += 20) {
    g.strokeStyle = '#E3E6EA'; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke();
    g.fillStyle = '#526170'; g.fillText(`${v}%`, 22, y(v) + 4);
  }
  const ticks = Math.min(8, pts.length);
  for (let i = 0; i < ticks; i += 1) {
    const p = pts[Math.round(i * (pts.length - 1) / Math.max(1, ticks - 1))]!;
    g.fillStyle = '#526170'; g.fillText(formatBr(p.date).slice(0, 5) + '/' + p.date.slice(2, 4), x(p.date) - 26, H - B + 22);
  }
  const line = (values: { date: string; v: number }[], color: string, width: number, dash: number[] = []) => {
    if (!values.length) return;
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.beginPath();
    values.forEach((p, i) => (i ? g.lineTo(x(p.date), y(p.v)) : g.moveTo(x(p.date), y(p.v))));
    g.stroke(); g.setLineDash([]); g.lineWidth = 1;
  };
  line(pts.map((p) => ({ date: p.date, v: p.planned })), `#${GOLD}`, 4);
  line(pts.filter((p) => p.actual !== null).map((p) => ({ date: p.date, v: p.actual as number })), `#${NAVY}`, 4);
  if (result.statusDate >= result.start && result.statusDate <= result.finish) {
    g.strokeStyle = `#${RED}`; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(x(result.statusDate), T); g.lineTo(x(result.statusDate), H - B); g.stroke(); g.setLineDash([]);
  }
  const lx = L, ly = H - 22;
  ([[`#${GOLD}`, 'Planejado'], [`#${NAVY}`, 'Realizado'], [`#${RED}`, 'Data de referência']] as [string, string][]).forEach(([color, label], i) => {
    g.fillStyle = color; g.fillRect(lx + i * 220, ly - 10, 26, 6); g.fillStyle = `#${INK}`; g.fillText(label, lx + i * 220 + 34, ly - 4);
  });
  return c.toDataURL('image/png');
}

function cashImage(result: PlannerResult) {
  const W = 1000, H = 420, L = 90, R = 30, T = 50, B = 60;
  const { c, g } = canvas(W, H);
  const months = result.months;
  const max = Math.max(1, ...months.map((m) => m.cost));
  const bw = (W - L - R) / Math.max(1, months.length);
  g.fillStyle = `#${NAVY}`; g.font = 'bold 20px "Century Gothic", Arial, sans-serif';
  g.fillText('Desembolso mensal previsto', L, 30);
  g.font = '12px "Century Gothic", Arial, sans-serif';
  for (let i = 0; i <= 4; i += 1) {
    const v = max * i / 4, yy = T + (1 - i / 4) * (H - T - B);
    g.strokeStyle = '#E3E6EA'; g.beginPath(); g.moveTo(L, yy); g.lineTo(W - R, yy); g.stroke();
    g.fillStyle = '#526170'; g.fillText(`R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`, 8, yy + 4);
  }
  months.forEach((m, i) => {
    const h = m.cost / max * (H - T - B);
    g.fillStyle = `#${GOLD}`; g.fillRect(L + i * bw + bw * 0.15, H - B - h, bw * 0.7, h);
    if (months.length <= 18 || i % 2 === 0) { g.fillStyle = '#526170'; g.fillText(m.label, L + i * bw + bw * 0.12, H - B + 20); }
  });
  return c.toDataURL('image/png');
}

function ganttImage(result: PlannerResult) {
  const rows = result.rows;
  const rowH = 26, L = 330, R = 30, T = 60, W = 1400;
  const H = T + rows.length * rowH + 50;
  const { c, g } = canvas(W, H);
  const t0 = d(result.start).getTime(), t1 = Math.max(t0 + 1, d(result.finish).getTime() + 86_400_000);
  const x = (iso: string, end = false) => L + ((d(iso).getTime() + (end ? 86_400_000 : 0)) - t0) / (t1 - t0) * (W - L - R);
  g.fillStyle = `#${NAVY}`; g.font = 'bold 20px "Century Gothic", Arial, sans-serif';
  g.fillText('Gráfico de Gantt', 16, 30);
  g.font = '12px "Century Gothic", Arial, sans-serif';
  result.months.forEach((m) => {
    const xx = x(`${m.month}-01` < result.start ? result.start : `${m.month}-01`);
    g.strokeStyle = '#E3E6EA'; g.beginPath(); g.moveTo(xx, T - 10); g.lineTo(xx, H - 40); g.stroke();
    g.fillStyle = '#526170'; g.fillText(m.label, xx + 4, T - 14);
  });
  rows.forEach((r, i) => {
    const yy = T + i * rowH;
    if (i % 2 === 0) { g.fillStyle = '#F7F8FA'; g.fillRect(0, yy, W, rowH); }
    g.fillStyle = `#${INK}`;
    const label = `${r.code}  ${r.name}`;
    g.fillText(label.length > 44 ? `${label.slice(0, 43)}…` : label, 16, yy + 17);
    const x0 = x(r.start), x1 = x(r.finish, true);
    g.fillStyle = r.critical ? `#${RED}` : `#${NAVY}`; g.globalAlpha = 0.25; g.fillRect(x0, yy + 6, x1 - x0, rowH - 12); g.globalAlpha = 1;
    g.fillStyle = r.critical ? `#${RED}` : `#${NAVY}`; g.fillRect(x0, yy + 6, (x1 - x0) * r.progress / 100, rowH - 12);
    g.strokeStyle = r.critical ? `#${RED}` : `#${NAVY}`; g.strokeRect(x0, yy + 6, x1 - x0, rowH - 12);
  });
  const mark = (iso: string | null, color: string, label: string) => {
    if (!iso || iso < result.start || iso > result.finish) return;
    const xx = x(iso); g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(xx, T - 6); g.lineTo(xx, H - 40); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    g.fillStyle = color; g.fillText(label, xx + 4, H - 24);
  };
  mark(result.statusDate, `#${GOLD}`, 'Hoje / referência');
  mark(result.deadline, `#${RED}`, 'Deadline');
  g.fillStyle = `#${INK}`; g.fillText('Barra cheia = avanço realizado · vermelho = caminho crítico', 16, H - 10);
  return c.toDataURL('image/png');
}

/* ---------- planilha ---------- */
export async function buildPlannerXlsx(project: PlannerProject, result: PlannerResult): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') throw new Error('Gere o Excel pelo portal no navegador do computador.');
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Camila Martins Engenharia Civil';
  wb.company = 'Camila Martins Engenharia Civil';
  wb.title = `Cronograma — ${project.name}`;
  wb.created = new Date();

  const header = (ws: any, title: string, lastCol: number) => {
    ws.mergeCells(1, 1, 1, lastCol);
    const c1 = ws.getCell(1, 1);
    c1.value = 'CAMILA MARTINS ENGENHARIA CIVIL';
    c1.font = { bold: true, size: 11, color: { argb: GOLD } }; c1.fill = fill(NAVY); c1.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 22;
    ws.mergeCells(2, 1, 2, lastCol);
    const c2 = ws.getCell(2, 1);
    c2.value = `${title} — ${project.name}${project.client ? ` · ${project.client}` : ''}`;
    c2.font = { bold: true, size: 15, color: { argb: 'FFFFFF' } }; c2.fill = fill(NAVY); c2.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(2).height = 28;
  };
  const tableHead = (ws: any, rowNumber: number, labels: string[]) => {
    const row = ws.getRow(rowNumber);
    labels.forEach((label, i) => {
      const cell = row.getCell(i + 1);
      cell.value = label; cell.fill = fill(GOLD); cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = box;
    });
    row.height = 44;
  };

  /* Resumo */
  const resumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }], pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 } });
  header(resumo, 'Cronograma da obra', 8);
  resumo.getColumn(1).width = 30; resumo.getColumn(2).width = 26; resumo.getColumn(3).width = 4; resumo.getColumn(4).width = 30; resumo.getColumn(5).width = 26;
  const deadlineText = result.deadline
    ? (result.deadlineMarginCalendarDays! >= 0 ? `${result.deadlineMarginCalendarDays} dias de folga` : `${-result.deadlineMarginCalendarDays!} dias ALÉM do deadline`)
    : 'Sem deadline informado';
  const forecastText = result.deadline
    ? (result.forecastMarginCalendarDays! >= 0 ? `Dentro do prazo (${result.forecastMarginCalendarDays} dias de folga)` : `Risco: ${-result.forecastMarginCalendarDays!} dias de atraso`)
    : '—';
  const info: [string, any, string?][] = [
    ['Obra / projeto', project.name], ['Cliente', project.client || '—'], ['Endereço', project.address || '—'], ['Responsável técnica', project.responsible || '—'],
    ['Calendário de trabalho', `${calendarLabel[project.calendar]}${project.nationalHolidays && project.calendar !== 'all_days' ? ' · feriados nacionais descontados' : ''}`],
    ['Data de referência (medição)', d(result.statusDate), dateFmt],
  ];
  const kpis: [string, any, string?][] = [
    ['Início', d(result.start), dateFmt], ['Término planejado', d(result.finish), dateFmt],
    ['Deadline', result.deadline ? d(result.deadline) : '—', result.deadline ? dateFmt : undefined],
    ['Margem até o deadline', deadlineText],
    ['Duração', `${result.workDays} dias de trabalho · ${result.calendarDays} dias corridos`],
    ['Avanço planejado na data', result.plannedPercent, pct], ['Avanço real na data', result.actualPercent, pct],
    ['Índice de prazo (IDP/SPI)', result.spi ?? '—', result.spi !== null ? '0.00' : undefined],
    ['Término previsto no ritmo atual', d(result.forecastFinish), dateFmt], ['Situação do prazo', forecastText],
    ['Custo total da obra', result.totalCost, money],
    ['Atividades', `${result.counts.total} no total · ${result.counts.done} concluídas · ${result.counts.running} em andamento · ${result.counts.delayed} atrasadas`],
  ];
  const putBlock = (startRow: number, col: number, title: string, items: [string, any, string?][]) => {
    resumo.mergeCells(startRow, col, startRow, col + 1);
    const t = resumo.getCell(startRow, col); t.value = title; t.font = { bold: true, color: { argb: NAVY }, size: 12 }; t.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
    items.forEach(([label, value, fmt], i) => {
      const r = startRow + 1 + i;
      const a = resumo.getCell(r, col), b = resumo.getCell(r, col + 1);
      a.value = label; a.font = { color: { argb: '526170' } }; a.fill = fill(NAVY_SOFT); a.border = box;
      b.value = value; b.font = { bold: true, color: { argb: INK } }; b.border = box; b.alignment = { wrapText: true, vertical: 'middle' };
      if (fmt) b.numFmt = fmt;
    });
  };
  putBlock(4, 1, 'Dados da obra', info);
  putBlock(4, 4, 'Indicadores', kpis);
  const situationCell = resumo.getCell(4 + 1 + 9, 5);
  situationCell.font = { bold: true, color: { argb: result.forecastMarginCalendarDays !== null && result.forecastMarginCalendarDays < 0 ? RED : GREEN } };
  const curveId = wb.addImage({ base64: curveImage(result), extension: 'png' });
  resumo.addImage(curveId, { tl: { col: 0, row: 18 }, ext: { width: 760, height: 350 } });
  const cashId = wb.addImage({ base64: cashImage(result), extension: 'png' });
  resumo.addImage(cashId, { tl: { col: 0, row: 37 }, ext: { width: 760, height: 320 } });
  if (result.warnings.length) {
    const r = 56; resumo.getCell(r, 1).value = 'Observações do cálculo'; resumo.getCell(r, 1).font = { bold: true, color: { argb: RED } };
    result.warnings.forEach((w, i) => { resumo.getCell(r + 1 + i, 1).value = `• ${w}`; });
  }

  /* Cronograma */
  const cols = ['Código', 'Etapa', 'Atividade', 'Predecessoras', 'Duração (dias de trabalho)', 'Início', 'Término', 'Dias corridos', 'Início mais tarde', 'Término mais tarde', 'Folga (dias)', 'Crítica', 'Peso (%)', 'Custo (R$)', 'Planejado na data (%)', 'Avanço real (%)', 'Peso realizado (%)', 'Situação', 'Responsável', 'Observações'];
  const cron = wb.addWorksheet('Cronograma', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  header(cron, 'Cronograma detalhado', cols.length);
  tableHead(cron, 4, cols);
  [9, 22, 40, 14, 12, 12, 12, 10, 12, 12, 9, 8, 9, 15, 12, 11, 12, 14, 18, 36].forEach((w, i) => (cron.getColumn(i + 1).width = w));
  result.rows.forEach((r, i) => {
    const n = 5 + i;
    const row = cron.getRow(n);
    row.values = [r.code, r.group, r.name, r.predecessors, r.duration, d(r.start), d(r.finish), { formula: `G${n}-F${n}+1` }, d(r.lateStart), d(r.lateFinish), r.totalFloat, r.critical ? 'Sim' : 'Não', r.weight, r.cost, r.plannedNow, r.progress, { formula: `M${n}*P${n}/100` }, r.status, r.responsible, r.notes];
    [6, 7, 9, 10].forEach((c) => (row.getCell(c).numFmt = dateFmt));
    [13, 15, 16, 17].forEach((c) => (row.getCell(c).numFmt = pct));
    row.getCell(14).numFmt = money;
    for (let c = 1; c <= cols.length; c += 1) { const cell = row.getCell(c); cell.border = box; cell.alignment = { vertical: 'middle', wrapText: c === 3 || c === 20 }; }
    if (r.critical) { row.getCell(12).font = { bold: true, color: { argb: RED } }; row.getCell(1).fill = fill('FBEAEA'); }
    const statusColor = r.status === 'Concluída' ? GREEN : r.status === 'Atrasada' ? RED : r.status === 'Em andamento' ? GOLD : '526170';
    row.getCell(18).font = { bold: true, color: { argb: statusColor } };
    if (i % 2 === 1) for (let c = 2; c <= cols.length; c += 1) if (!row.getCell(c).fill?.fgColor) row.getCell(c).fill = fill('FAFBFC');
  });
  const last = 4 + result.rows.length;
  const tot = cron.getRow(last + 1);
  tot.getCell(3).value = 'TOTAL';
  tot.getCell(6).value = { formula: `MIN(F5:F${last})` }; tot.getCell(7).value = { formula: `MAX(G5:G${last})` };
  tot.getCell(8).value = { formula: `G${last + 1}-F${last + 1}+1` };
  tot.getCell(13).value = { formula: `SUM(M5:M${last})` }; tot.getCell(14).value = { formula: `SUM(N5:N${last})` };
  tot.getCell(15).value = { formula: `SUMPRODUCT(M5:M${last},O5:O${last})/100` }; tot.getCell(17).value = { formula: `SUM(Q5:Q${last})` };
  [6, 7].forEach((c) => (tot.getCell(c).numFmt = dateFmt)); [13, 15, 17].forEach((c) => (tot.getCell(c).numFmt = pct)); tot.getCell(14).numFmt = money;
  for (let c = 1; c <= cols.length; c += 1) { tot.getCell(c).font = { bold: true, color: { argb: 'FFFFFF' } }; tot.getCell(c).fill = fill(NAVY); }
  cron.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: cols.length } };
  cron.getCell(last + 3, 1).value = 'Avanço real é editável: altere a coluna P e o "Peso realizado" e o total se atualizam automaticamente.';
  cron.getCell(last + 3, 1).font = { italic: true, color: { argb: '526170' } };

  /* Gantt (células) */
  const spanDays = Math.round((d(result.finish).getTime() - d(result.start).getTime()) / 86_400_000) + 1;
  const weekly = spanDays > 150;
  const unit = weekly ? 7 : 1;
  const periods: string[] = [];
  for (let offset = 0; offset < spanDays; offset += unit) periods.push(new Date(d(result.start).getTime() + offset * 86_400_000).toISOString().slice(0, 10));
  const gantt = wb.addWorksheet('Gantt', { views: [{ state: 'frozen', xSplit: 4, ySplit: 5, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  header(gantt, `Gantt ${weekly ? 'semanal' : 'diário'}`, Math.min(4 + periods.length, 60));
  ['Código', 'Atividade', 'Início', 'Término'].forEach((label, i) => { const cell = gantt.getCell(5, i + 1); cell.value = label; cell.fill = fill(GOLD); cell.font = { bold: true, color: { argb: 'FFFFFF' } }; cell.border = box; });
  gantt.getColumn(1).width = 8; gantt.getColumn(2).width = 38; gantt.getColumn(3).width = 11; gantt.getColumn(4).width = 11;
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  periods.forEach((p, i) => {
    const col = 5 + i;
    gantt.getColumn(col).width = weekly ? 4.5 : 3.2;
    const top = gantt.getCell(4, col);
    if (i === 0 || p.slice(5, 7) !== periods[i - 1]!.slice(5, 7)) { top.value = `${monthNames[Number(p.slice(5, 7)) - 1]}/${p.slice(2, 4)}`; top.font = { bold: true, color: { argb: NAVY } }; }
    const h = gantt.getCell(5, col);
    h.value = Number(p.slice(8, 10)); h.alignment = { horizontal: 'center' }; h.font = { size: 8, color: { argb: 'FFFFFF' } }; h.fill = fill(NAVY);
    const end = new Date(d(p).getTime() + (unit - 1) * 86_400_000).toISOString().slice(0, 10);
    if (result.deadline && result.deadline >= p && result.deadline <= end) h.fill = fill(RED);
    if (result.statusDate >= p && result.statusDate <= end) h.fill = fill(GOLD);
  });
  const holidaySet = new Set(result.holidays);
  result.rows.forEach((r, i) => {
    const n = 6 + i;
    const row = gantt.getRow(n);
    row.getCell(1).value = r.code; row.getCell(2).value = r.name; row.getCell(3).value = d(r.start); row.getCell(4).value = d(r.finish);
    row.getCell(3).numFmt = 'dd/mm/yy'; row.getCell(4).numFmt = 'dd/mm/yy';
    if (r.critical) row.getCell(1).font = { bold: true, color: { argb: RED } };
    const totalDays = Math.max(1, Math.round((d(r.finish).getTime() - d(r.start).getTime()) / 86_400_000) + 1);
    const doneUntil = new Date(d(r.start).getTime() + Math.round(totalDays * r.progress / 100) * 86_400_000 - 86_400_000).toISOString().slice(0, 10);
    periods.forEach((p, k) => {
      const end = new Date(d(p).getTime() + (unit - 1) * 86_400_000).toISOString().slice(0, 10);
      const cell = row.getCell(5 + k);
      cell.border = { left: { style: 'hair', color: { argb: 'E3E6EA' } }, bottom: { style: 'hair', color: { argb: 'E3E6EA' } } };
      if (r.start <= end && r.finish >= p) {
        const done = r.progress > 0 && p <= doneUntil;
        cell.fill = fill(done ? (r.critical ? '7A1810' : NAVY) : (r.critical ? 'F2B8B5' : 'C9D3E3'));
      } else if (!weekly && holidaySet.has(p)) cell.fill = fill('F1F1F1');
    });
  });
  const legendRow = 7 + result.rows.length;
  ([[NAVY, 'Realizado'], ['7A1810', 'Crítica (realizado)'], ['C9D3E3', 'Planejado'], ['F2B8B5', 'Crítica (planejado)'], [GOLD, 'Data de referência'], [RED, 'Deadline']] as [string, string][]).forEach(([color, label], i) => {
    gantt.getCell(legendRow + i, 2).value = label; gantt.getCell(legendRow + i, 1).fill = fill(color);
  });
  const ganttId = wb.addImage({ base64: ganttImage(result), extension: 'png' });
  const imgRow = legendRow + 7;
  gantt.getCell(imgRow - 1, 2).value = 'Gantt em imagem (para impressão e apresentação):'; gantt.getCell(imgRow - 1, 2).font = { bold: true, color: { argb: NAVY } };
  gantt.addImage(ganttId, { tl: { col: 1, row: imgRow }, ext: { width: 1100, height: Math.round(1100 * (90 + result.rows.length * 26) / 1400) } });

  /* Curva S */
  const curve = wb.addWorksheet('Curva S', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  header(curve, 'Curva S', 6);
  tableHead(curve, 4, ['Data', 'Planejado acumulado (%)', 'Realizado acumulado (%)', 'Desvio (p.p.)']);
  [14, 18, 18, 14].forEach((w, i) => (curve.getColumn(i + 1).width = w));
  result.curve.forEach((p, i) => {
    const n = 5 + i;
    const row = curve.getRow(n);
    row.values = [d(p.date), p.planned, p.actual ?? null, p.actual === null ? null : { formula: `C${n}-B${n}` }];
    row.getCell(1).numFmt = dateFmt; [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = '0.00'));
    for (let c = 1; c <= 4; c += 1) row.getCell(c).border = box;
  });
  curve.addImage(wb.addImage({ base64: curveImage(result), extension: 'png' }), { tl: { col: 5, row: 3 }, ext: { width: 760, height: 350 } });

  /* Desembolso */
  const cash = wb.addWorksheet('Desembolso mensal', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  header(cash, 'Desembolso mensal', 6);
  tableHead(cash, 4, ['Mês', 'Custo previsto (R$)', 'Acumulado (R$)', 'Acumulado (%)']);
  [14, 20, 20, 16].forEach((w, i) => (cash.getColumn(i + 1).width = w));
  result.months.forEach((m, i) => {
    const n = 5 + i;
    const row = cash.getRow(n);
    row.values = [m.label, m.cost, i === 0 ? { formula: `B${n}` } : { formula: `C${n - 1}+B${n}` }, { formula: `IF(SUM($B$5:$B$${4 + result.months.length})=0,0,C${n}/SUM($B$5:$B$${4 + result.months.length})*100)` }];
    row.getCell(2).numFmt = money; row.getCell(3).numFmt = money; row.getCell(4).numFmt = '0.0"%"';
    for (let c = 1; c <= 4; c += 1) row.getCell(c).border = box;
  });
  const cashTot = cash.getRow(5 + result.months.length);
  cashTot.getCell(1).value = 'TOTAL'; cashTot.getCell(2).value = { formula: `SUM(B5:B${4 + result.months.length})` }; cashTot.getCell(2).numFmt = money;
  [1, 2, 3, 4].forEach((c) => { cashTot.getCell(c).fill = fill(NAVY); cashTot.getCell(c).font = { bold: true, color: { argb: 'FFFFFF' } }; });
  cash.addImage(wb.addImage({ base64: cashImage(result), extension: 'png' }), { tl: { col: 5, row: 3 }, ext: { width: 760, height: 320 } });

  /* Caminho crítico */
  const crit = wb.addWorksheet('Caminho crítico', { views: [{ showGridLines: false }] });
  header(crit, 'Caminho crítico', 6);
  tableHead(crit, 4, ['Ordem', 'Código', 'Atividade', 'Início', 'Término', 'Duração (dias)']);
  [8, 9, 44, 13, 13, 14].forEach((w, i) => (crit.getColumn(i + 1).width = w));
  result.criticalCodes.forEach((code, i) => {
    const r = result.rows.find((x) => x.code === code)!;
    const row = crit.getRow(5 + i);
    row.values = [i + 1, r.code, r.name, d(r.start), d(r.finish), r.duration];
    row.getCell(4).numFmt = dateFmt; row.getCell(5).numFmt = dateFmt;
    for (let c = 1; c <= 6; c += 1) row.getCell(c).border = box;
  });
  const note = 6 + result.criticalCodes.length;
  crit.getCell(note, 1).value = 'Atividades críticas não têm folga: qualquer atraso nelas atrasa o término da obra.';
  crit.getCell(note, 1).font = { italic: true, color: { argb: '526170' } };

  /* Calendário */
  const calWs = wb.addWorksheet('Calendário', { views: [{ showGridLines: false }] });
  header(calWs, 'Calendário de trabalho', 4);
  calWs.getColumn(1).width = 16; calWs.getColumn(2).width = 40;
  calWs.getCell(4, 1).value = 'Regime'; calWs.getCell(4, 2).value = calendarLabel[project.calendar];
  tableHead(calWs, 6, ['Data', 'Feriado / dia sem trabalho']);
  const names = new Map<string, string>();
  for (let year = Number(result.start.slice(0, 4)); year <= Number(result.finish.slice(0, 4)); year += 1) nationalHolidays(year).forEach((h) => names.set(h.date, h.name));
  result.holidays.forEach((h, i) => {
    const row = calWs.getRow(7 + i);
    row.values = [d(h), names.get(h) ?? 'Feriado informado'];
    row.getCell(1).numFmt = dateFmt; row.getCell(1).border = box; row.getCell(2).border = box;
  });
  if (!result.holidays.length) calWs.getCell(7, 1).value = 'Nenhum feriado dentro do período da obra.';

  const buffer = await wb.xlsx.writeBuffer();
  const safe = project.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'cronograma';
  const fileName = `Cronograma-${safe}-${result.statusDate}.xlsx`;
  return { buffer, fileName };
}

export async function exportPlannerXlsx(project: PlannerProject, result: PlannerResult): Promise<string> {
  const { buffer, fileName } = await buildPlannerXlsx(project, result);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fileName;
}
