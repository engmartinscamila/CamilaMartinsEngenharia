// A09: estados efetivamente usados no banco e no site clássico. Um estado
// desconhecido é preservado e exibido como está, sem transição silenciosa.
const PROJECT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'arquivado', label: 'Arquivado' },
];
export function projectStatusOptions(current: string | null | undefined) {
  const value = String(current ?? '').trim();
  if (!value || PROJECT_STATUS_OPTIONS.some((option) => option.value === value)) return PROJECT_STATUS_OPTIONS;
  return [{ value, label: `${value.replace(/_/g, ' ')} (atual)` }, ...PROJECT_STATUS_OPTIONS];
}

export function projectStatusLabel(status: string | null | undefined) {
  const value = String(status ?? '').trim();
  return PROJECT_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? (value ? value.replace(/_/g, ' ') : 'Não informado');
}
