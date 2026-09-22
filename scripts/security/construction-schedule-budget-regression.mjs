import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('../../supabase/migrations/20260922235500_cronograma_quantitativos_auditaveis.sql',import.meta.url),'utf8');
const rpc=fs.readFileSync(new URL('../../supabase/migrations/20260922235800_cronograma_orcamento_execucao_rpc.sql',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../../portal-app/src/services/construction-schedule-budget-service.ts',import.meta.url),'utf8');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks+=1;};

ok(/quantity\s*\*\s*NEW\.unit_cost|NEW\.quantity\s*\*\s*NEW\.unit_cost/i.test(guard),'guard confere quantidade × preço unitário');
ok(/Fonte do custo da execução é obrigatória/i.test(guard),'fonte é obrigatória no backend');
ok(/Quantitativo incompleto/i.test(guard),'composição parcial é rejeitada');
ok(/activation_status IS DISTINCT FROM 'draft'/i.test(rpc),'orçamento executivo só altera rascunho');
ok(/count\(DISTINCT value->>'code'\)/i.test(rpc),'códigos duplicados são detectados');
ok(/v_count IS DISTINCT FROM v_existing/i.test(rpc),'payload precisa cobrir todas as atividades');
ok(/round\(v_quantity \* v_unit_cost, 2\)/i.test(rpc),'custo composto é derivado no servidor');
ok(/weight_percent = CASE/i.test(rpc),'peso financeiro é recalculado pelo RPC');
ok(/v_cost \* 100 \/ v_total/i.test(rpc),'peso deriva do custo da execução');
ok(/weight_source = 'construction_costs'/i.test(rpc),'origem do peso é marcada como custo da obra');
ok(/set_construction_schedule_execution_budget/i.test(rpc),'alteração fica auditada');
ok(!/honor[aá]rio/i.test(rpc),'RPC não usa honorários como custo da obra');
ok(/admin_set_full_schedule_execution_budget/i.test(service),'app grava pelo RPC auditável');

console.log(`ORÇAMENTO EXECUTIVO: ${checks} verificações defensivas passaram.`);
