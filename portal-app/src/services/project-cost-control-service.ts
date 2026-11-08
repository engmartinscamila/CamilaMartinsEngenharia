import { supabase } from '@/lib/supabase';
import {
  calculateProjectCostEvidence,
  type CostActivity,
  type CostExpense,
  type ProjectCostEvidence,
  type SelectedQuote,
} from '@/lib/project-cost-control';

export interface ProjectCostReport {
  scheduleTitle: string | null;
  budgetStatus: 'approved' | 'legacy' | 'missing';
  activities: CostActivity[];
  evidence: ProjectCostEvidence;
}
type CostReportResult = { data: ProjectCostReport | null; error: string | null };
const PAGE = 300;
const MAX_ROWS = 30000;

/**
 * Fontes reais, somente leitura e filtradas pelo projeto:
 * - linha-base vigente e suas atividades (nunca o rascunho de reprogramação);
 * - saídas financeiras já cadastradas; não cria pagamentos, recibos ou custos;
 * - cotações aprovadas (referência comercial, NÃO pedido de compra).
 * Consultas incompletas sempre falham fechadas. Sem contrato também é aceito.
 */
export async function loadProjectCostReport(projectId: string): Promise<CostReportResult> {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(projectId)) {
    return {data: null, error: 'Selecione um projeto válido.'};
  }
  try {
    const scheduleResult = await supabase.from('construction_schedules')
      .select('id,title,activation_status').eq('project_id', projectId)
      .eq('is_current', true).order('revision_number', {ascending:false})
      .limit(1).maybeSingle();
    if (scheduleResult.error) throw new Error('Não foi possível conferir a linha-base do projeto.');

    const activities: CostActivity[] = [];
    if (scheduleResult.data) {
      for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
        const page = await supabase.from('construction_schedule_items')
          .select('code,activity,planned_cost,actual_cost')
          .eq('schedule_id', scheduleResult.data.id)
          .order('display_order', {ascending: true}).order('id', {ascending:true})
          .range(offset, offset + PAGE - 1);
        if (page.error) throw new Error('Falha ao consultar os custos das atividades. Nenhum total foi calculado.');
        for (const item of page.data ?? []) {
          activities.push({
            code: String(item.code), activity: String(item.activity ?? ''),
            plannedCost: item.planned_cost === null ? null : Number(item.planned_cost),
            measuredCost: item.actual_cost === null ? null : Number(item.actual_cost),
          });
        }
        if ((page.data ?? []).length < PAGE) break;
        if (offset + PAGE >= MAX_ROWS) throw new Error('Há atividades demais para garantir uma leitura completa.');
      }
    }

    const expenses: CostExpense[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const page = await supabase.from('financeiro')
        .select('id,tipo,status,valor').eq('projeto_id', projectId)
        .eq('tipo', 'saida').order('id', {ascending:true}).range(offset, offset + PAGE - 1);
      if (page.error) throw new Error('Não foi possível ler todas as despesas. Totais não exibidos.');
      for (const entry of page.data ?? []) {
        expenses.push({id: String(entry.id), type: String(entry.tipo), status: entry.status,
          amount: Number(entry.valor)});
      }
      if ((page.data ?? []).length < PAGE) break;
      if (offset + PAGE >= MAX_ROWS) throw new Error('Há despesas demais para garantir uma leitura completa.');
    }

    const quotes: SelectedQuote[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const page = await supabase.from('purchase_quotes')
        .select('id,title,status,selected_supplier_id,supplier_bids(id,supplier_id,total_amount)')
        .eq('project_id', projectId).order('id', {ascending:true}).range(offset, offset + PAGE - 1);
      if (page.error) throw new Error('Não foi possível conferir todas as propostas de fornecedores.');
      for (const quote of page.data ?? []) {
        const matches = (quote.supplier_bids ?? [])
          .filter((bid: {supplier_id: string}) => bid.supplier_id === quote.selected_supplier_id);
        if (matches.length > 1) throw new Error('Foram encontradas propostas duplicadas para um fornecedor selecionado.');
        quotes.push({
          id: String(quote.id), title: String(quote.title ?? ''),
          status: String(quote.status ?? ''),
          selectedSupplierId: quote.selected_supplier_id,
          selectedAmount: matches.length === 1 ? Number(matches[0].total_amount) : null,
        });
      }
      if ((page.data ?? []).length < PAGE) break;
      if (offset + PAGE >= MAX_ROWS) throw new Error('Há cotações demais para garantir uma leitura completa.');
    }

    const budgetStatus = scheduleResult.data?.activation_status === 'approved' ? 'approved'
      : scheduleResult.data ? 'legacy' : 'missing';
    const evidence = calculateProjectCostEvidence(
      activities, expenses, quotes, budgetStatus === 'approved',
    );
    return {
      data: {scheduleTitle: scheduleResult.data?.title ?? null, budgetStatus, activities, evidence},
      error: null,
    };
  } catch (error) {
    return {data: null, error: error instanceof Error ? error.message : 'Falha ao conferir os custos deste projeto.'};
  }
}
