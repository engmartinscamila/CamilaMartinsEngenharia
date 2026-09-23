import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir=path.resolve('supabase/migrations');
const file=fs.readdirSync(dir).find(name=>name.endsWith('_commercial_service_level_per_item.sql'));
assert.ok(file,'migration de nível por serviço não encontrada');
const sql=fs.readFileSync(path.join(dir,file),'utf8');

let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks+=1;};

ok(sql.includes("v_item->>'levelCode'"), 'nível explícito do item tem prioridade');
ok(sql.includes("v_item#>>'{level,code}'"), 'snapshot aninhado também é reconhecido');
ok(sql.includes("v_legacy_level_code"), 'nível global antigo fica somente como fallback');
ok(sql.includes("Selecione Bronze, Prata ou Ouro para o serviço"), 'serviço aplicável incluído exige nível');
ok(sql.includes("'levelCode',case when v_catalog.level_applicable then v_item_level_code else null end"), 'snapshot grava código de nível por serviço');
ok(sql.includes("'level',v_level_json"), 'snapshot grava metadados versionados do nível');
ok(sql.includes("revoke all on function public.enrich_commercial_services(jsonb,text) from public,anon,authenticated"), 'RPC auxiliar não é exposta aos papéis de cliente');
ok(sql.includes("grant execute on function public.enrich_commercial_services(jsonb,text) to service_role"), 'enriquecimento fica restrito ao fluxo de servidor');

console.log(`SNAPSHOT NÍVEL POR SERVIÇO: ${checks} verificações passaram.`);
