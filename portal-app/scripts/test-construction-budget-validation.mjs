import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,deps={})=>{
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports,Number,Math,Date,console,require:name=>{if(!(name in deps))throw Error('Não esperado: '+name);return deps[name];}});
 return exports;
};
const {analyzeExecutionBudget:analyze}=load('src/lib/construction-budget-validation.ts');
const item=(code,quantity,unitCost,plannedCost='',unit='m²',costSource='SINAPI SP 11/2026')=>({
 code,activity:'Atividade '+code,displayOrder:0,quantity,unitCost,plannedCost,unit,costSource,weightPercent:0,
});
let out=analyze([item('A','2,5','1.250,50')]);
assert(out.valid);assert.equal(out.total,3126.25);assert.equal(out.lines[0].quantity,2.5);assert.equal(out.lines[0].unit_cost,1250.5);
out=analyze([item('A','1,005','1,00')]);
assert.equal(out.total,1.01,'Arredondamento por linha deve seguir o PostgreSQL numeric');
out=analyze([item('A','0,125','2,00'),item('B','','','1.000,00','')]);
assert.equal(out.total,1000.25);assert.equal(out.lines[1].planned_cost,1000);
assert.equal(out.lines[1].quantity,null,'Custo direto não gera quantidade artificial');
out=analyze([item('A','1e3','12')]);assert(!out.valid,'Não aceitar notação exponencial');
out=analyze([item('A','1 2','12')]);assert(!out.valid,'Espaços internos não podem alterar quantidades silenciosamente');
out=analyze([item('A','2','1.000.00')]);assert(!out.valid,'Separadores ambíguos bloqueados');
out=analyze([item('A','2','','3')]);assert(!out.valid,'Composição incompleta bloqueada');
out=analyze([item('A','2','10'),item('A','3','20')]);assert(!out.valid,'Códigos repetidos bloqueados');
out=analyze([item('A','2','10','','m²','')]);assert(!out.valid,'Custo sem origem bloqueado');
out=analyze([item('A','','','0','')]);assert(!out.valid,'Execução não pode ter orçamento zero');
let rpcCall=null;let rpcResult={data:{total_construction_cost:1000.25},error:null};
const supabase={rpc:async(name,args)=>{rpcCall={name,args};return rpcResult;}};
const svc=load('src/services/construction-schedule-budget-service.ts',{
 '@/lib/supabase':{supabase},'@/lib/construction-budget-validation':{analyzeExecutionBudget:analyze}
});
const draft={scheduleId:'schedule-1',projectId:'project-1',title:'Execução',revisionNumber:2,
 items:[item('A','0,125','2,00'),item('B','','','1.000,00','')]};
let result=await svc.saveCurrentScheduleBudget(draft);
assert.equal(result.error,null);assert.equal(result.total,1000.25);
assert.equal(rpcCall.name,'admin_set_full_schedule_execution_budget');
assert.equal(rpcCall.args.p_items[0].quantity,0.125);assert.equal(rpcCall.args.p_items[0].unit_cost,2);
assert.equal(rpcCall.args.p_items[1].planned_cost,1000);
rpcCall=null;result=await svc.saveCurrentScheduleBudget({...draft,items:[item('A','2','','','','')]});
assert(result.error);assert.equal(rpcCall,null,'Erro deve bloquear RPC de orçamento');
rpcResult={data:{total_construction_cost:1001},error:null};
result=await svc.saveCurrentScheduleBudget(draft);
assert(result.error?.includes('total diferente'),'Divergência da resposta do banco deve bloquear confirmação');
console.log('PASS: execução — numeração brasileira, custos em centavos, totais, fonte, composição completa e mesma validação UI/serviço.');
