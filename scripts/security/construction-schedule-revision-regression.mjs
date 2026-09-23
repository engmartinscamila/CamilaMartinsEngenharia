import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../../supabase/migrations/20260922234500_cronograma_revisoes_aditivos.sql',import.meta.url),'utf8');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks+=1;};

ok(/DROP CONSTRAINT IF EXISTS construction_schedules_project_id_key/i.test(sql),'remove limitação de um cronograma por projeto');
ok(/UNIQUE INDEX[\s\S]*project_id, revision_number/i.test(sql),'revision_number é único por projeto');
ok(/UNIQUE INDEX[\s\S]*project_id\)[\s\S]*WHERE is_current IS TRUE/i.test(sql),'só uma versão vigente por projeto');
ok(/supersedes_schedule_id uuid REFERENCES public\.construction_schedules\(id\) ON DELETE RESTRICT/i.test(sql),'revisão referencia versão anterior sem cascata destrutiva');
ok(/admin_begin_full_schedule_revision/i.test(sql),'há RPC explícita para iniciar aditivo/reprogramação');
ok(/activation_status IS DISTINCT FROM 'approved'[\s\S]*is_current IS NOT TRUE/i.test(sql),'revisão parte somente da versão vigente aprovada');
ok(/não copiar custos|sem copiar custos|Custos, datas, pesos e atividades exigem nova conferência/i.test(sql),'nova revisão não reaproveita custos como verdade atual');
ok(/Já existe uma revisão em rascunho/i.test(sql),'bloqueia rascunhos concorrentes');
ok(/assert_full_schedule_commercial_link/i.test(sql),'novo orçamento/contrato é revalidado');
ok(/UPDATE public\.construction_schedules[\s\S]*SET is_current = false/i.test(sql),'aprovação retira marcador vigente da anterior');
ok(/UPDATE public\.construction_schedules[\s\S]*SET is_current = true/i.test(sql),'aprovação promove nova revisão');
ok(!/DELETE FROM public\.construction_schedules/i.test(sql),'versionamento nunca apaga cronogramas anteriores');
ok(/Projeto já possui cronograma aprovado vigente; abra uma revisão\/aditivo/i.test(sql),'inicializador comum não sobrescreve aprovado');
ok(/SECURITY INVOKER/i.test(sql),'novas funções não usam SECURITY DEFINER');

console.log(`REVISÕES DE CRONOGRAMA: ${checks} verificações defensivas passaram.`);
