export function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
}

export function formatDate(value: string | null | undefined, fallback = 'Não informada') {
  if (!value) return fallback;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('pt-BR');
}

export function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : null;
}

export function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function formatCurrency(value: number | null | undefined, currency = 'BRL') {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

/** Convert monetary numbers to exact cents; reject meaningful fractional cents. */
export function monetaryCents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const scaled=value*100, cents=Math.round(scaled);
  if (!Number.isSafeInteger(cents) || Math.abs(scaled-cents)>Number.EPSILON*Math.max(1,Math.abs(scaled))*2) return null;
  return cents;
}

export function parseBrazilianCurrency(value: string) {
  const compact=value.trim().replace(/\s/g,'').replace(/^R\$/i,'');
  // Brazilian grouped integers, optionally followed by one or two decimal digits.
  // A single dot with one/two trailing digits remains compatible with decimal input.
  let normalized:string;
  if (/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(compact)) {
    normalized=compact.replace(/\./g,'').replace(',','.');
  } else if (/^-?\d+\.\d{1,2}$/.test(compact)) {
    normalized=compact;
  } else return null;
  const parsed=Number(normalized), cents=monetaryCents(parsed);
  return cents===null?null:cents/100;
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function humanizeStatus(value: string) {
  const labels: Record<string, string> = {
    aguardando: 'Aguardando resposta',
    needsAction: 'Aguardando confirmação',
    accepted: 'Confirmada',
    tentative: 'Talvez',
    declined: 'Recusada',
    aprovado: 'Aceito',
    aprovado_com_ressalvas: 'Aceito com ressalvas',
    rejeitado: 'Recusado',
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    orcamento: 'Em orçamento',
    ativo: 'Ativo',
    arquivado: 'Arquivado',
    concluido: 'Concluído',
    concluida: 'Concluída',
    pausado: 'Pausado',
    cancelado: 'Cancelado',
    cancelada: 'Cancelada',
  };
  return labels[value] ?? labels[normalizeStatus(value)] ?? value.replaceAll('_', ' ');
}

/** Preserve unknown database values separately from explicit zero. */
export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
