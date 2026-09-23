import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const root = new URL('../../', import.meta.url);
let checks=0;
const sql=(query)=>db.exec(query);
const scalar=async(q)=>(await db.query(q)).rows[0]?.value;
const check=(truth,label)=>{assert.ok(truth,label);checks++;};
const fail=async(q,reason)=>{let error;try{await sql(q);}catch(e){error=e;}assert.ok(error,reason);checks++;};
await sql(`create role anon; create role authenticated;
create function public.is_portal_admin() returns boolean language sql as
$$select coalesce(current_setting('cme.admin',true),'')='yes'$$;
create function public.assert_full_schedule_commercial_link(uuid,uuid,uuid)
returns jsonb language plpgsql as $$begin
if not public.is_portal_admin() then raise exception 'admin obrigatório'; end if;
if $1 is null or $2 is null or $3 is null then raise exception 'vínculo não informado';end if;
return jsonb_build_object('quote_id',$2,'contract_id',$3);end$$;
set cme.admin='yes';`);
await sql(fs.readFileSync(new URL('supabase/migrations/20260921182000_cronograma_biblioteca_modelos_versionados.sql',root),'utf8'));
check(await scalar("select count(*)::int value from construction_schedule_templates")===4,'Quatro modelos versionados');
check(await scalar("select count(*)::int value from construction_schedule_template_items where template_code='residential_reference'")===20,'20 atividades residenciais de referência');
check(Number(await scalar("select sum(reference_weight_percent) value from construction_schedule_template_items where template_code='residential_reference'"))===100,'Pesos residenciais totalizam 100 somente como referência');
check(await scalar("select count(*)::int value from construction_schedule_template_items where template_code='renovation_reference' and (reference_weight_percent is not null or reference_duration_days is not null)")===0,'Reforma não promete pesos ou prazos inventados');
check(await scalar('select count(*)::int value from construction_schedule_template_items where not requires_scope_confirmation')===0,'Nenhuma atividade é confirmada automaticamente');
const u='10000000-0000-4000-8000-000000000001';
const result=await db.query(`select public.admin_preview_full_schedule_template('${u}'::uuid,'${u}'::uuid,'${u}'::uuid,'residential_reference') value`);
check(result.rows[0].value.items.length===20,'Prévia residencial contém as 20 sugestões');
check(result.rows[0].value.requires_scope_confirmation===true,'Prévia exige validação de escopo');
const partial=await db.query(`select public.admin_preview_full_schedule_template('${u}'::uuid,'${u}'::uuid,'${u}'::uuid,'partial_scope') value`);
check(partial.rows[0].value.items.length===0,'Execução parcial inicia sem etapas fictícias');
await sql("set cme.admin='no'");
await fail(`select public.admin_preview_full_schedule_template('${u}'::uuid,'${u}'::uuid,'${u}'::uuid,'residential_reference')`,'Usuário não administrador não deve obter prévia');
console.log(`BIBLIOTECA DE CRONOGRAMAS: ${checks} checks passaram sem inserir projetos ou clientes.`);
