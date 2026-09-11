import { downloadBase64File } from '@/lib/download-generated-file';
import { supabase } from '@/lib/supabase';

export interface ConstructionProjectOption {
  id: string;
  clientId: string;
  contractId: string | null;
  name: string;
  type: string | null;
  clientName: string;
  contractNumber: string | null;
  workAddress: string | null;
  startDate: string | null;
  finishDate: string | null;
  builtArea: number | null;
  landArea: number | null;
}

export interface ConstructionScheduleHeader {
  id: string;
  projectId: string;
  clientId: string;
  contractId: string | null;
  title: string;
  templateVersion: string;
  referenceDate: string;
  plannedStart: string | null;
  plannedFinish: string | null;
  notes: string | null;
}

export interface ConstructionScheduleItem {
  id: string;
  scheduleId: string;
  code: string;
  category: string;
  activity: string;
  displayOrder: number;
  weightPercent: number;
  plannedDurationDays: number;
  predecessorCode: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  actualProgress: number;
  plannedCost: number | null;
  actualCost: number | null;
  status: string;
  notes: string | null;
  isDefault: boolean;
}

const workAddress = (row: Record<string, unknown>) => [row.endereco_obra, row.numero_obra, row.complemento_obra, row.bairro_obra, row.cidade_obra, row.estado_obra].filter(Boolean).join(', ') || null;

export async function listConstructionScheduleProjects() {
  const [projectsResult, clientsResult] = await Promise.all([
    supabase.from('projetos').select('id,cliente_id,contract_id,nome,tipo,numero_contrato,data_inicio,data_fim,area_construida_m2,area_terreno_m2,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra').order('created_at', { ascending: false }).limit(200),
    supabase.from('clientes').select('id,nome').limit(500),
  ]);
  if (projectsResult.error) return { data: [] as ConstructionProjectOption[], error: 'Não foi possível carregar os projetos.' };
  const names = new Map((clientsResult.data ?? []).map((row) => [row.id, row.nome]));
  return {
    data: (projectsResult.data ?? []).map((row) => ({
      id: row.id,
      clientId: row.cliente_id,
      contractId: row.contract_id,
      name: row.nome,
      type: row.tipo,
      clientName: names.get(row.cliente_id) ?? 'Cliente',
      contractNumber: row.numero_contrato,
      workAddress: workAddress(row as Record<string, unknown>),
      startDate: row.data_inicio,
      finishDate: row.data_fim,
      builtArea: row.area_construida_m2 === null ? null : Number(row.area_construida_m2),
      landArea: row.area_terreno_m2 === null ? null : Number(row.area_terreno_m2),
    })),
    error: clientsResult.error ? 'Projetos carregados, mas alguns nomes de cliente podem estar indisponíveis.' : null,
  };
}

export async function initializeConstructionSchedule(projectId: string) {
  const result = await supabase.rpc('admin_initialize_construction_schedule', { p_project_id: projectId });
  return result.error || !result.data ? { scheduleId: null, error: result.error?.message ?? 'Não foi possível preparar o cronograma da obra.' } : { scheduleId: String(result.data), error: null };
}

export async function loadConstructionSchedule(projectId: string) {
  const headerResult = await supabase.from('construction_schedules').select('id,project_id,client_id,contract_id,title,template_version,reference_date,planned_start,planned_finish,notes').eq('project_id', projectId).maybeSingle();
  if (headerResult.error) return { header: null, items: [] as ConstructionScheduleItem[], error: 'Não foi possível carregar o cronograma.' };
  if (!headerResult.data) return { header: null, items: [] as ConstructionScheduleItem[], error: null };
  const itemsResult = await supabase.from('construction_schedule_items').select('id,schedule_id,code,category,activity,display_order,weight_percent,planned_duration_days,predecessor_code,planned_start,planned_finish,actual_start,actual_finish,actual_progress,planned_cost,actual_cost,status,notes,is_default').eq('schedule_id', headerResult.data.id).order('display_order', { ascending: true });
  if (itemsResult.error) return { header: null, items: [], error: 'Não foi possível carregar as atividades do cronograma.' };
  return {
    header: {
      id: headerResult.data.id,
      projectId: headerResult.data.project_id,
      clientId: headerResult.data.client_id,
      contractId: headerResult.data.contract_id,
      title: headerResult.data.title,
      templateVersion: headerResult.data.template_version,
      referenceDate: headerResult.data.reference_date,
      plannedStart: headerResult.data.planned_start,
      plannedFinish: headerResult.data.planned_finish,
      notes: headerResult.data.notes,
    } as ConstructionScheduleHeader,
    items: (itemsResult.data ?? []).map((row) => ({
      id: row.id, scheduleId: row.schedule_id, code: row.code, category: row.category, activity: row.activity,
      displayOrder: Number(row.display_order ?? 0), weightPercent: Number(row.weight_percent ?? 0), plannedDurationDays: Number(row.planned_duration_days ?? 0), predecessorCode: row.predecessor_code,
      plannedStart: row.planned_start, plannedFinish: row.planned_finish, actualStart: row.actual_start, actualFinish: row.actual_finish,
      actualProgress: Number(row.actual_progress ?? 0), plannedCost: row.planned_cost === null ? null : Number(row.planned_cost), actualCost: row.actual_cost === null ? null : Number(row.actual_cost),
      status: row.status, notes: row.notes, isDefault: Boolean(row.is_default),
    })),
    error: null,
  };
}

export async function updateConstructionSchedule(header: ConstructionScheduleHeader) {
  const result = await supabase.from('construction_schedules').update({
    title: header.title,
    reference_date: header.referenceDate || null,
    planned_start: header.plannedStart || null,
    planned_finish: header.plannedFinish || null,
    notes: header.notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', header.id);
  return result.error?.message ?? null;
}

export async function updateConstructionScheduleItem(item: ConstructionScheduleItem) {
  const result = await supabase.from('construction_schedule_items').update({
    code: item.code.trim(), category: item.category.trim(), activity: item.activity.trim(), display_order: item.displayOrder,
    weight_percent: item.weightPercent, planned_duration_days: item.plannedDurationDays, predecessor_code: item.predecessorCode?.trim() || null,
    planned_start: item.plannedStart || null, planned_finish: item.plannedFinish || null, actual_start: item.actualStart || null, actual_finish: item.actualFinish || null,
    actual_progress: item.actualProgress, planned_cost: item.plannedCost, actual_cost: item.actualCost, status: item.status.trim() || 'Pendente', notes: item.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', item.id);
  return result.error?.message ?? null;
}

export async function addConstructionScheduleItem(scheduleId: string, displayOrder: number) {
  const code = `X${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const result = await supabase.from('construction_schedule_items').insert({
    schedule_id: scheduleId,
    code,
    category: 'Específica',
    activity: 'Nova atividade específica da obra',
    display_order: displayOrder,
    weight_percent: 0,
    planned_duration_days: 1,
    actual_progress: 0,
    status: 'Pendente',
    is_default: false,
  }).select('id').single();
  return result.error ? { id: null, error: result.error.message } : { id: result.data.id, error: null };
}

export async function deleteConstructionScheduleItem(id: string) {
  const result = await supabase.from('construction_schedule_items').delete().eq('id', id);
  return result.error?.message ?? null;
}

export async function exportConstructionScheduleXlsx(projectId: string) {
  const result = await supabase.functions.invoke('generate-construction-schedule-xlsx', { body: { projectId } });
  if (result.error || !result.data?.generated || !result.data?.contentBase64) return result.data?.error ?? result.error?.message ?? 'Não foi possível gerar o Excel do cronograma.';
  try {
    await downloadBase64File(String(result.data.contentBase64), String(result.data.fileName ?? 'Cronograma-Obra.xlsx'));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'A planilha foi gerada, mas o download não pôde ser aberto.';
  }
}
