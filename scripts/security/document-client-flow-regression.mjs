import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL functions and production column types, with synthetic rows.
// No adapters replace SQL authorization, hashing, constraints or transactions.
const baseline=JSON.parse(fs.readFileSync('supabase/security/document-client-flow-baseline-20261106.json','utf8'));
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const q=s=>'"'+s.replaceAll('"','""')+'"';
let checks=0;
const equal=(a,b,label)=>{assert.equal(a,b,label);checks++;};
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_portal_admin() returns boolean language sql stable as $$select coalesce(auth.uid()='${id(99)}'::uuid,false)$$;
 create function public.user_has_project_access(p uuid) returns boolean language sql stable as $$select coalesce((auth.uid()='${id(1)}'::uuid and p='${id(10)}'::uuid) or (auth.uid()='${id(2)}'::uuid and p='${id(20)}'::uuid),false)$$;
 create function public.current_client_id() returns uuid language sql stable as $$select case when auth.uid()='${id(1)}'::uuid then '${id(11)}'::uuid when auth.uid()='${id(2)}'::uuid then '${id(21)}'::uuid end$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
 set check_function_bodies=off;`);
 for(const name of new Set(baseline.columns.map(c=>c.table_name))){
  const cols=baseline.columns.filter(c=>c.table_name===name);
  await db.exec(`create table public.${q(name)} (${cols.map(c=>q(c.name)+' '+c.type).join(',')});`);
 }
 await db.exec(`alter table document_acceptances alter id set default gen_random_uuid();
 alter table document_acceptances add unique(document_id,user_id);
 alter table document_acceptances alter project_id set not null;
 alter table document_acceptances alter client_id set not null;
 alter table app_push_tokens add unique(expo_push_token);`);
 await db.exec('create policy document_acceptances_authorized_read on public.document_acceptances for select to authenticated using(public.is_portal_admin() or public.user_has_project_access(project_id));');
 for(const f of baseline.functions)await db.exec(f.definition);
 if(!process.env.CME_CLIENT_FLOW_BASELINE_ONLY){
  const migrations=process.env.CME_CLIENT_FLOW_MIGRATION?[process.env.CME_CLIENT_FLOW_MIGRATION]:fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('_client_document_acceptance_hash.sql')).sort().map(f=>'supabase/migrations/'+f);
  assert.ok(migrations.length,'Acceptance hash migration must exist');
  for(const migration of migrations)await db.exec(fs.readFileSync(migration,'utf8'));
  const standalone=process.env.CME_STANDALONE_MIGRATION?[process.env.CME_STANDALONE_MIGRATION]:fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('_standalone_document_acceptance.sql')).sort().map(f=>'supabase/migrations/'+f);
  for(const migration of standalone)await db.exec(fs.readFileSync(migration,'utf8'));
 }
 await db.exec(`grant execute on all functions in schema public to authenticated;
 insert into projetos(id,cliente_id) values('${id(10)}','${id(11)}'),('${id(20)}','${id(21)}');`);
 const as=async n=>db.exec(`reset role;set request.jwt.claim.sub='${n?id(n):''}';set role authenticated;`);
 const emit=async n=>{
  await db.exec('reset role');
  await db.query(`insert into documentos(id,projeto_id,cliente_id,nome,versao,generated_data,client_visible,exibir_cliente,acceptance_required,snapshot_frozen_at,client_released_at) values($1,$2,$3,'Documento sintético','2.0','{}',true,false,true,now(),now())`,[id(n),id(10),id(11)]);
 };
 const accept=(n,decision='accepted',note=null)=>db.query('select client_accept_document($1,$2,$3,$4,$5) id',[id(n),decision,note,'web',{}]);
 const denied=async(task,pattern)=>{await assert.rejects(task,pattern);checks++;};
 await emit(30);await as(1);
 const accepted=(await accept(30)).rows[0].id;assert.ok(accepted);
 await db.exec('reset role');
 const row=(await db.query('select * from document_acceptances where id=$1',[accepted])).rows[0];
 equal(row.snapshot_hash,createHash('sha256').update('{}|'+id(30)+'|2.0').digest('hex'),'Fallback SHA-256 must match real bytes');
 equal(row.document_version,'2.0');equal(row.client_id,id(11));equal(row.user_id,id(1));
 equal((await db.query('select count(*)::int n from notificacoes where referencia_id=$1',[accepted])).rows[0].n,1);
 await as(1);await denied(()=>accept(30),/já registrou/);
 for(const n of [31,32,33,34,35,36,37,38,39,40,41,42])await emit(n);
 await db.query('insert into document_emission_snapshots(document_id,snapshot_hash,emitted_at) values($1,$2,now())',[id(31),'persisted-frozen-hash']);
 await as(1);await accept(31,'accepted_with_notes','Observação sintética');
 await db.exec('reset role');equal((await db.query('select snapshot_hash from document_acceptances where document_id=$1',[id(31)])).rows[0].snapshot_hash,'persisted-frozen-hash');
 await as(2);await denied(()=>accept(32),/cliente vinculado/);
 await as(99);await denied(()=>accept(32),/cliente vinculado/);
 await as(null);await denied(()=>accept(32),/Sessão/);
 await as(1);await denied(()=>accept(32,'rejected'),/observação/);await accept(32,'rejected','Rejeição sintética');
 await db.exec('reset role');await db.query('update documentos set superseded_by=$1 where id=$2',[id(30),id(33)]);
 await as(1);await denied(()=>accept(33),/substituída/);
 await db.exec('reset role');await db.query("update documentos set valid_until=current_date-1 where id=$1",[id(34)]);
 await as(1);await denied(()=>accept(34),/expirado/);
 await db.exec('reset role');await db.query('update documentos set client_visible=false,client_released_at=null where id=$1',[id(35)]);
 await as(1);await denied(()=>accept(35),/liberado/);
 await db.exec('reset role');await db.query('update documentos set snapshot_frozen_at=null where id=$1',[id(36)]);
 await as(1);await denied(()=>accept(36),/congelado/);
 await denied(()=>accept(37,'invented'),/inválida/);
 await as(1);await denied(()=>db.query('select admin_release_document_for_client($1,true,null,null)',[id(38)]),/administrativo/);
 await db.exec('reset role');await db.query('update documentos set client_released_at=null,client_visible=false,exibir_cliente=false where id=$1',[id(38)]);
 await as(99);await db.query('select admin_release_document_for_client($1,true,null,null)',[id(38)]);
 await db.exec('reset role');const releaseTime=(await db.query('select client_released_at from documentos where id=$1',[id(38)])).rows[0].client_released_at;
 await as(99);await db.query('select admin_release_document_for_client($1,true,null,null)',[id(38)]);
 await db.exec('reset role');equal((await db.query("select count(*)::int n from notificacoes where referencia_id=$1 and tipo='document_release'",[id(38)])).rows[0].n,1,'Repeated release must not duplicate notification');
 equal(+(await db.query('select client_released_at from documentos where id=$1',[id(38)])).rows[0].client_released_at,+releaseTime,'Repeated release must preserve timestamp');
 await as(1);await accept(38);
 const replace=(a,b)=>db.query('select admin_supersede_document($1,$2,$3)',[id(a),id(b),'Correção sintética']);
 await denied(()=>replace(39,40),/administrativo/);
 await as(99);await replace(39,40);await replace(39,40);
 await denied(()=>replace(39,41),/já substituído/);
 await denied(()=>replace(40,39),/destino/);
 await db.exec('reset role');await db.query('update documentos set cliente_id=$1 where id=$2',[id(21),id(42)]);
 await as(99);await denied(()=>replace(41,42),/inválida/);
 await as(1);await denied(()=>accept(39),/cliente vinculado|liberado|substituída/);
 await emit(43);await db.query('update documentos set projeto_id=null,client_released_at=null,client_visible=false where id=$1',[id(43)]);
 await as(99);await db.query('select admin_release_document_for_client($1,true,null,null)',[id(43)]);
 await as(2);await denied(()=>accept(43),/cliente vinculado/);
 await as(1);await accept(43);
 await db.exec('reset role');const standaloneRow=(await db.query('select * from document_acceptances where document_id=$1',[id(43)])).rows[0];
 equal(standaloneRow.client_id,id(11));equal(standaloneRow.project_id,null);
 await db.exec('grant select on documentos,document_acceptances to authenticated;alter table document_acceptances enable row level security;');
 await as(1);equal((await db.query('select count(*)::int n from document_acceptances where document_id=$1',[id(43)])).rows[0].n,1);
 equal((await db.query('select count(*)::int n from client_document_map(null) where document_id=$1',[id(43)])).rows[0].n,1);
 await as(2);equal((await db.query('select count(*)::int n from document_acceptances where document_id=$1',[id(43)])).rows[0].n,0);
 equal((await db.query('select count(*)::int n from client_document_map(null) where document_id=$1',[id(43)])).rows[0].n,0);
 for(const prefix of ['Expo','Exponent']){
  const token=prefix+'PushToken[abcdefghijklmnopqrstuv]';
  equal((await db.query('select register_own_push_token($1,$2,$3) ok',[token,'android','Synthetic device'])).rows[0].ok,true);
  equal((await db.query('select register_own_push_token($1,$2,$3) ok',[token,'ios','Synthetic device'])).rows[0].ok,true);
 }
 await denied(()=>db.query('select register_own_push_token($1,$2,$3)',['invalid-token-invalid-token','ios',null]),/Token inválido/);
 await as(null);await denied(()=>db.query('select register_own_push_token($1,$2,$3)',['ExpoPushToken[abcdefghijklmnopqrstuv]','ios',null]),/Sessão/);
 console.log(`PASS ${checks} PostgreSQL checks: real acceptance hash, immutable snapshot, identity, duplicate, rejection, expiry, supersession, release, authentication and valid push registration.`);
}finally{await db.close();}
