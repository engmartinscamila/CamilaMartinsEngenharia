import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL evaluates the exported production policies with synthetic data.
// No customer records, external services, credentials or emails are used.
const root = new URL('../../', import.meta.url);
const baseline = JSON.parse(fs.readFileSync(new URL('supabase/security/baseline-20260907.json', root)));
const quote = value => '"' + value.replaceAll('"','""') + '"';
const db = new PGlite();
let checks = 0;
const sql = text => db.exec(text);
const count = async text => Number((await db.query(text)).rows[0].n);
const eq = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };

await sql(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema private; create schema storage;
grant usage on schema public, auth, private, storage to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as
$$ select current_user::text $$;
create function storage.foldername(text) returns text[] language sql immutable as
$$ select string_to_array($1,'/') $$;
create table storage.objects (id uuid, bucket_id text, name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
set check_function_bodies = off;`);
for (const t of baseline.tables.filter(t => t.schema === 'public' && ['r','p'].includes(t.relkind))) {
  const cols = baseline.columns.filter(c => c.table_name === t.relname);
  await sql(`create table public.${quote(t.relname)} (${cols.map(c => quote(c.name)+' '+c.type).join(',')});`);
  eq(t.relrowsecurity, true, `${t.relname} must enable RLS in the exported database`);
  await sql(`alter table public.${quote(t.relname)} enable row level security;`);
}
for (const f of [...baseline.privateFunctions,...baseline.functions]) await sql(f.def);
await sql('alter table client_password_link_rate_limits add primary key(key_hash); grant all on client_password_link_rate_limits to service_role;');
for (const g of baseline.grants) {
  if (baseline.tables.some(t => t.relname === g.table_name && t.relkind === 'v')) continue;
  await sql(`grant ${g.privilege_type} on public.${quote(g.table_name)} to ${quote(g.grantee)};`);
}
for (const p of baseline.policies) {
  if (p.schemaname === 'storage' && p.tablename !== 'objects') continue;
  const roles = p.roles.replace(/[{}]/g,'').split(',').map(quote).join(',');
  await sql(`create policy ${quote(p.policyname)} on ${quote(p.schemaname)}.${quote(p.tablename)}
    as ${p.permissive} for ${p.cmd} to ${roles}
    ${p.qual ? 'using ('+p.qual+')' : ''} ${p.with_check ? 'with check ('+p.with_check+')' : ''};`);
}
const migrations = fs.readdirSync(new URL('supabase/migrations/',root))
  .filter(f => f >= '20260907233715_' && f.endsWith('.sql')).sort();
assert(migrations.length, 'Missing security migration');
for (const file of migrations) await sql(fs.readFileSync(new URL('supabase/migrations/'+file,root),'utf8'));

const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ca='10000000-0000-4000-8000-000000000001', cb='10000000-0000-4000-8000-000000000002';
const pa='20000000-0000-4000-8000-000000000001', pb='20000000-0000-4000-8000-000000000002';
const admin='5c9d7a0e-0495-4e96-8561-1d7f220be154';
await sql(`insert into clientes(id,auth_id,status) values ('${ca}','${a}','ativo'),('${cb}','${b}','ativo');
insert into projetos(id,cliente_id) values ('${pa}','${ca}'),('${pb}','${cb}');
insert into project_members(project_id,user_id,active) values ('${pa}','${a}',true),('${pb}','${b}',true);
insert into project_portal_settings(project_id,show_documents,show_photos,show_library,show_requests)
values ('${pa}',true,true,true,true),('${pb}',true,true,true,true);
insert into pdf_admins(user_id) values ('${admin}');
insert into documentos(id,cliente_id,projeto_id,arquivo,storage_bucket,protection_mode,document_kind,generated_at,client_visible,client_released_at)
values
('30000000-0000-4000-8000-000000000001','${ca}','${pa}','a/manual.pdf','documentos','administrative',null,null,false,null),
('30000000-0000-4000-8000-000000000002','${cb}','${pb}','b/manual.pdf','documentos','administrative',null,null,false,null),
('30000000-0000-4000-8000-000000000003','${ca}','${pa}','a/draft.pdf','documentos','administrative','contrato',now(),false,null),
('30000000-0000-4000-8000-000000000004','${ca}','${pa}','a/released.pdf','documentos','administrative','contrato',now(),true,now()),
('30000000-0000-4000-8000-000000000005','${ca}','${pa}','a/authored.pdf','documentos','authored_pdf',null,null,false,null);
insert into fotos(id,cliente_id,projeto_id,arquivo,storage_bucket,protection_mode)
values ('40000000-0000-4000-8000-000000000001','${ca}','${pa}','a/photo.jpg','fotos','authored_photo');
insert into storage.objects(bucket_id,name) values
('documentos','a/manual.pdf'),('documentos','b/manual.pdf'),('documentos','a/draft.pdf'),
('documentos','a/released.pdf'),('documentos','a/authored.pdf'),('fotos','a/photo.jpg'),('documentos','a/orphan.pdf');`);
const as = async (role,id='') => sql(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
const denied = async (statement,label) => {
  let rejected=false;
  try { await sql(statement); } catch (e) { rejected = e.code === '42501'; }
  eq(rejected,true,label);
};
await as('anon');
for (const t of ['clientes','documentos','financeiro','pdf_admins']) {
  try { eq(await count(`select count(*) n from ${t}`),0,`anonymous ${t}`); }
  catch(e) { if(e.code!=='42501') throw e; checks++; }
}
for (const [uid,cid,pid,other] of [[a,ca,pa,pb],[b,cb,pb,pa]]) {
  await as('authenticated',uid);
  eq(await count('select count(*) n from clientes'),1,'one own profile');
  eq(await count(`select count(*) n from projetos where id='${other}'`),0,'other project denied');
  eq((await db.query(`select is_portal_admin() value`)).rows[0].value,false,'client cannot become admin');
  eq((await db.query(`select can_access_project('${other}') value`)).rows[0].value,false,'other project RPC denied');
  eq(await count(`select count(*) n from documentos where cliente_id<>'${cid}'`),0,'cross-client document metadata denied');
  eq(await count('select count(*) n from financeiro'),0,'finance private');
  await denied(`insert into solicitacoes(cliente_id,projeto_id,origem,status) values ('${cid}','${pid}','admin','nova')`,'cannot spoof administrator request');
  await denied(`insert into solicitacoes(cliente_id,projeto_id,origem,status) values ('${cid}','${pid}','cliente','concluida')`,'cannot force completed request');
  await sql(`insert into solicitacoes(cliente_id,projeto_id,origem,status) values ('${cid}','${pid}','cliente','nova')`);
  checks++;
}
await as('authenticated',a);
eq(await count('select count(*) n from documentos'),3,'own manual, released and protected metadata visible');
eq(await count(`select count(*) n from documentos where arquivo='a/draft.pdf'`),0,'draft metadata denied');
eq(await count('select count(*) n from storage.objects'),2,'only own unprotected released/manual originals');
eq(await count(`select count(*) n from storage.objects where name in ('a/authored.pdf','a/photo.jpg','a/draft.pdf','a/orphan.pdf','b/manual.pdf')`),0,'protected, draft, orphan and foreign originals denied');
await as('postgres');
await sql(`update project_portal_settings set show_documents=false where project_id='${pa}'`);
await as('authenticated',a);
eq(await count('select count(*) n from documentos'),0,'hidden module denied');
eq(await count(`select count(*) n from client_document_map('${pa}')`),0,'document map RPC obeys hidden module');
eq(await count('select count(*) n from storage.objects'),0,'hidden module files denied');
await as('postgres');
await sql(`update project_portal_settings set show_documents=true where project_id='${pa}'; update clientes set status='inativo' where id='${ca}'`);
await as('authenticated',a);
eq((await db.query('select private.cliente_atual_id() value')).rows[0].value,null,'suspended legacy client denied');
eq((await db.query(`select user_has_project_access('${pa}') value`)).rows[0].value,false,'active membership cannot bypass suspension');
eq(await count('select count(*) n from documentos'),0,'suspended document access denied');
eq(await count('select count(*) n from storage.objects'),0,'suspended storage access denied');
await as('authenticated',admin);
eq((await db.query('select is_portal_admin() value')).rows[0].value,true,'administrator verified on server');
eq(await count('select count(*) n from documentos'),5,'admin still sees every document');
eq(await count('select count(*) n from storage.objects'),7,'admin original access preserved');
await as('postgres');
await sql(`update clientes set status='ativo' where id='${ca}';
update documentos set autoral=true where arquivo='a/manual.pdf';
insert into biblioteca(id,cliente_id,projeto_id,arquivo,storage_bucket,autoral)
values (6000001,'${ca}','${pa}','a/library.pdf','biblioteca',true);
insert into storage.objects(bucket_id,name) values ('biblioteca','a/library.pdf');`);
await as('authenticated',a);
eq(await count(`select count(*) n from biblioteca where arquivo='a/library.pdf'`),1,'authored library metadata remains available for server issuance');
eq(await count(`select count(*) n from storage.objects where name in ('a/manual.pdf','a/library.pdf')`),0,'legacy authored document and library originals denied');
await as('authenticated',admin);
eq(await count(`select count(*) n from storage.objects where name in ('a/manual.pdf','a/library.pdf')`),2,'admin retains legacy authored originals');
await as('postgres');
await as('service_role');
const hash = 'a'.repeat(64);
const consume = async () => (await db.query(`select service_consume_password_link_rate_limit('${hash}') value`)).rows[0].value;
eq(await consume(),true,'first recovery request allowed');
eq(await consume(),false,'immediate repeated recovery denied');
for (let i=0;i<4;i++) {
  await sql("update client_password_link_rate_limits set last_requested_at=now()-interval '2 minutes'");
  eq(await consume(),true,'recovery request within hourly limit');
}
await sql("update client_password_link_rate_limits set last_requested_at=now()-interval '2 minutes'");
eq(await consume(),false,'sixth recovery request denied');
await sql("update client_password_link_rate_limits set window_started_at=now()-interval '2 hours'");
eq(await consume(),true,'new recovery window allowed');
await as('authenticated',a);
await denied(`select service_consume_password_link_rate_limit('${hash}')`,'client cannot bypass recovery limit');
await as('anon');
await denied(`select service_consume_password_link_rate_limit('${hash}')`,'anonymous cannot bypass recovery limit');
await as('postgres');
await db.close();
console.log(`PASS: ${checks} PostgreSQL security assertions (synthetic A/B, suspended, admin, anonymous).`);
