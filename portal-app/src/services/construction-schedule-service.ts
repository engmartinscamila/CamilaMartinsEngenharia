import { downloadBase64File } from '@/lib/download-generated-file';
import { toUserMessage } from '@/lib/errors';
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

// As listas anteriores usavam .limit(200) para projetos e .limit(500) para
// clientes, ocultando registros legítimos à medida que o escritório crescia.
// Paginar com desempate por ID e buscar apenas os clientes dos projetos lidos.
const PAGE_SIZE = 200;
const MAX_PROJECTS = 20000;
export async function listConstructionScheduleProjects() {
  const projects: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (offset >= MAX_PROJECTS) return { data: [] as ConstructionProjectOption[], error: 'Há muitos projetos para carregar de uma só vez. Utilize uma seleção por cliente antes de continuar.' };
    const page = await supabase.from('projetos')
      .select('id,cliente_id,contract_id,nome,tipo,numero_contrato,data_inicio,data_fim,area_construida_m2,area_terreno_m2,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (page.error) return { data: [] as ConstructionProjectOption[], error: 'Não foi possível carregar todos os projetos.' };
    const rows = page.data ?? [];
    projects.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const clientIds = [...new Set(projects.map((row) => String(row.cliente_id ?? '')).filter(Boolean))];
  const names = new Map<string, string>();
  let namesError = false;
  for (let index = 0; index < clientIds.length; index += 100) {
    const page = await supabase.from('clientes').select('id,nome').in('id', clientIds.slice(index, index + 100));
    if (page.error) { namesError = true; break; }
    for (const row of page.data ?? []) names.set(row.id, row.nome);
  }
  return {
    data: projects.map((row) => ({
      id: String(row.id),
      clientId: String(row.cliente_id),
      contractId: row.contract_id ? String(row.contract_id) : null,
      name: String(row.nome ?? ''),
      type: row.tipo ? String(row.tipo) : null,
      clientName: names.get(String(row.cliente_id)) ?? 'Cliente',
      contractNumber: row.numero_contrato ? String(row.numero_contrato) : null,
      workAddress: workAddress(row),
      startDate: row.data_inicio ? String(row.data_inicio) : null,
      finishDate: row.data_fim ? String(row.data_fim) : null,
      builtArea: row.area_construida_m2 === null ? null : Number(row.area_construida_m2),
      landArea: row.area_terreno_m2 === null ? null : Number(row.area_terreno_m2),
    })),
    error: namesError ? 'Projetos carregados, mas alguns nomes de cliente podem estar indisponíveis.' : null,
  };
}

export async function initializeConstructionSchedule(projectId: string) {
  const result = await supabase.rpc('admin_initialize_construction_schedule', { p_project_id: projectId });
  return result.error || !result.data ? { scheduleId: null, error: toUserMessage(result.error, 'Este projeto ainda não possui cronograma completo ativo. Crie-o pelo fluxo de orçamento e contrato vinculados.') } : { scheduleId: String(result.data), error: null };
}

export async function loadConstructionSchedule(projectId: string) {
  const headerResult = await supabase.from('construction_schedules').select('id,project_id,client_id,contract_id,title,template_version,reference_date,planned_start,planned_finish,notes').eq('project_id', projectId).eq('is_current', true).maybeSingle();
  if (headerResult.error) return { header: null, items: [] as ConstructionScheduleItem[], error: 'Não foi possível carregar o cronograma vigente.' };
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
