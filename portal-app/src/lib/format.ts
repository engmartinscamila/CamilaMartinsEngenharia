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

export function parseBrazilianCurrency(value: string) {
  const compact = value.trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!compact || !/^-?[\d.,]+$/.test(compact)) return null;

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  if (commaCount > 1) return null;

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  if (lastComma >= 0) {
    normalized = compact.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const decimalDigits = compact.length - lastDot - 1;
    normalized = dotCount === 1 && decimalDigits > 0 && decimalDigits <= 2
      ? compact
      : compact.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    concluida: 'Concluída',
    pausado: 'Pausado',
    cancelado: 'Cancelado',
    cancelada: 'Cancelada',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}
