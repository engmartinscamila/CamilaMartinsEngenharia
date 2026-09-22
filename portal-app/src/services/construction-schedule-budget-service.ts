import { supabase } from '@/lib/supabase';

export interface ScheduleBudgetItem {
  code: string;
  activity: string;
  displayOrder: number;
  quantity: string;
  unit: string;
  unitCost: string;
  plannedCost: string;
  costSource: string;
  weightPercent: number;
}

export interface ScheduleBudgetDraft {
  scheduleId: string;
  projectId: string;
  title: string;
  revisionNumber: number;
  items: ScheduleBudgetItem[];
}

export async function loadCurrentScheduleBudget(projectId: string): Promise<{data: ScheduleBudgetDraft | null; error: string | null}> {
  const schedule = await supabase
    .from('construction_schedules')
    .select('id,project_id,title,activation_status,revision_number,is_current')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle();
  if (schedule.error) return { data: null, error: schedule.error.message ?? 'Não foi possível conferir o cronograma vigente.' };
  if (!schedule.data) return { data: null, error: 'O projeto ainda não possui cronograma vigente.' };
  if (schedule.data.activation_status !== 'draft') {
    return { data: null, error: 'O orçamento executivo só pode ser alterado enquanto a revisão vigente estiver em rascunho.' };
  }

  const items = await supabase
    .from('construction_schedule_items')
    .select('code,activity,display_order,quantity,unit,unit_cost,planned_cost,cost_source,weight_percent')
    .eq('schedule_id', schedule.data.id)
    .order('display_order', { ascending: true });
  if (items.error) return { data: null, error: items.error.message ?? 'Não foi possível carregar os itens da execução.' };

  return {
    data: {
      scheduleId: String(schedule.data.id),
      projectId: String(schedule.data.project_id),
      title: String(schedule.data.title ?? 'Cronograma'),
      revisionNumber: Number(schedule.data.revision_number ?? 1),
      items: (items.data ?? []).map((row) => ({
        code: String(row.code),
        activity: String(row.activity ?? ''),
        displayOrder: Number(row.display_order ?? 0),
        quantity: row.quantity === null ? '' : String(row.quantity),
        unit: row.unit ?? '',
        unitCost: row.unit_cost === null ? '' : String(row.unit_cost),
        plannedCost: row.planned_cost === null ? '' : String(row.planned_cost),
        costSource: row.cost_source ?? '',
        weightPercent: Number(row.weight_percent ?? 0),
      })),
    },
    error: null,
  };
}

const decimal = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : null;
};

export async function saveCurrentScheduleBudget(draft: ScheduleBudgetDraft): Promise<{total: number | null; error: string | null}> {
  const payload = draft.items.map((item) => {
    const quantity = decimal(item.quantity);
    const unitCost = decimal(item.unitCost);
    const direct = decimal(item.plannedCost);
    const hasComposition = item.quantity.trim() !== '' || item.unit.trim() !== '' || item.unitCost.trim() !== '';
    return {
      code: item.code,
      quantity: hasComposition ? quantity : null,
      unit: hasComposition ? item.unit.trim() : null,
      unit_cost: hasComposition ? unitCost : null,
      planned_cost: hasComposition ? null : direct,
      cost_source: item.costSource.trim(),
    };
  });
  const result = await supabase.rpc('admin_set_full_schedule_execution_budget', {
    p_schedule_id: draft.scheduleId,
    p_items: payload,
  });
  if (result.error || !result.data) {
    return { total: null, error: result.error?.message ?? 'Não foi possível salvar o orçamento de execução.' };
  }
  const data = result.data as Record<string, unknown>;
  return {
    total: data.total_construction_cost === undefined ? null : Number(data.total_construction_cost),
    error: null,
  };
}
