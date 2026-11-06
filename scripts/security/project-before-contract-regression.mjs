import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select current_user::text$$;
 create function is_portal_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
 create function assert_document_governance_ready() returns void language sql as $$select$$;
 create sequence test_contract_number;
 create function admin_next_commercial_number(text) returns text language sql as $$select $1||'-TEST-'||nextval('test_contract_number')$$;
 create function enrich_commercial_services(jsonb,text) returns jsonb language sql as $$select $1$$;
 create table clientes(id uuid primary key,auth_id uuid,nome text,status text,cpf_cnpj text,email text,telefone text,endereco text,cidade text,estado text,cep text);
 create table projetos(id uuid primary key default gen_random_uuid(),cliente_id uuid references clientes(id),contract_id uuid,nome text,tipo text,status text,
 endereco_obra text,numero_obra text,complemento_obra text,bairro_obra text,cidade_obra text,estado_obra text,cep_obra text,numero_orcamento text,numero_contrato text,
 area_terreno_m2 numeric,area_construida_m2 numeric,parceria boolean);
 create table project_members(project_id uuid,user_id uuid,role text,active boolean,updated_at timestamptz,primary key(project_id,user_id));
 create table contratos(id uuid primary key default gen_random_uuid(),cliente_id uuid,contract_number text,legacy_contract_number text,service_type text,status text,contract_value numeric,currency text,notes text,updated_at timestamptz);
 create table commercial_records(id uuid primary key default gen_random_uuid(),quote_number text,contract_number text,record_kind text,source_mode text,status text,
 linked_client_id uuid,linked_contract_id uuid,linked_project_id uuid,prospect_name text,cpf_cnpj text,email text,phone text,cep text,address text,city text,state text,
 property_address text,property_type text,area_terreno_m2 numeric,area_construida_m2 numeric,construction_standard text,experience_level text,services jsonb,
 custom_service text,total_value numeric,payment_terms jsonb,valid_until date,notes text,source_project_id uuid,contract_master_id uuid,contract_master_version int,
 quote_document_id uuid,contract_document_id uuid,updated_at timestamptz);
 create table commercial_contract_quote_links(contract_record_id uuid,quote_record_id uuid,created_at timestamptz default now(),primary key(contract_record_id,quote_record_id));
 create table contract_master_versions(id uuid default gen_random_uuid(),version int,active boolean);
 create table service_level_catalog(code text,active boolean);
 create table contract_scope_items(contract_id uuid,service_code text,service_name text,included boolean,acceptance_required boolean,display_order int,notes text,updated_at timestamptz,primary key(contract_id,service_code));
 create table documentos(id uuid,cliente_id uuid,projeto_id uuid,contract_id uuid);
 create table audit_log(user_id uuid,action text,entity_type text,entity_id uuid,details jsonb);
 insert into contract_master_versions(version,active) values(4,true);
 insert into clientes values('${id(1)}','${id(10)}','Cliente A','ativo','111','a@example.invalid',null,'Residência do cliente','Outra cidade','RJ',null),
 ('${id(2)}','${id(20)}','Cliente B','ativo',null,null,null,null,null,null,null),
 ('${id(3)}',null,'Inativo','inativo',null,null,null,null,null,null,null);
 grant usage on schema public,auth to authenticated;grant all on all tables in schema public to authenticated;grant usage on all sequences in schema public to authenticated;
 alter table projetos enable row level security;alter table project_members enable row level security;
 create policy project_admin on projetos for all to authenticated using(is_portal_admin()) with check(is_portal_admin());
 create policy members_admin on project_members for all to authenticated using(is_portal_admin()) with check(is_portal_admin());`);
 const file=process.env.CME_PROJECT_FLOW_MIGRATION||fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('_project_before_contract.sql')).sort().map(f=>'supabase/migrations/'+f).at(-1);
 assert.ok(file,'Migração de cadastro independente ausente');await db.exec(fs.readFileSync(file,'utf8'));
 assert.equal((await db.query("select has_function_privilege('anon','admin_create_project_draft(uuid,jsonb)','execute') ok")).rows[0].ok,false);
 await db.exec(`select set_config('test.uid','${id(99)}',false),set_config('test.admin','true',false);set role authenticated;`);
 const input={name:'Projeto anterior ao contrato',address:'Rua da Obra',number:'42',city:'São Paulo',state:'sp',contract_id:id(500),contract_number:'NÃO CRIAR'};
 const draft=async(client,data=input)=>(await db.query('select admin_create_project_draft($1,$2) id',[client,data])).rows[0].id;
 const project=await draft(id(1));let row=(await db.query('select * from projetos where id=$1',[project])).rows[0];
 assert.equal(row.contract_id,null);assert.equal(row.numero_contrato,null);assert.equal(row.numero_orcamento,null);assert.equal(row.status,'orcamento');assert.equal(row.estado_obra,'SP');
 assert.equal((await db.query('select count(*) n from contratos')).rows[0].n,0);
 assert.equal((await db.query('select user_id from project_members where project_id=$1',[project])).rows[0].user_id,id(10));
 await assert.rejects(()=>draft(id(3)),/ativo/);await assert.rejects(()=>draft(id(1),{name:'Projeto',address:''}),/endereço/);
 const payload={linked_client_id:id(1),prospect_name:'Cliente A',total_value:'12000',services:[],payment_terms:[]};
 const contract=async(data=payload,quotes=[],p=project)=>(await db.query('select admin_create_independent_contract($1,$2,$3) id',[data,quotes,p])).rows[0].id;
 await assert.rejects(()=>contract({...payload,linked_client_id:id(2)}),/pertencer/);
 const record=await contract();let commercial=(await db.query('select * from commercial_records where id=$1',[record])).rows[0];
 assert.equal(commercial.source_project_id,project);assert.equal(commercial.source_mode,'manual');assert.equal(commercial.linked_client_id,id(1));assert.equal(commercial.property_address,'Rua da Obra, 42, São Paulo, SP');
 assert.equal((await db.query('select assert_commercial_contract_quote_consistency($1) data',[record])).rows[0].data.consistent,true);
 const linked=(await db.query('select admin_formalize_service_contract($1) data',[record])).rows[0].data;
 assert.equal(linked.project_id,project);row=(await db.query('select * from projetos where id=$1',[project])).rows[0];
 assert.equal(row.endereco_obra,'Rua da Obra');assert.equal(row.numero_obra,'42');assert.equal(row.cidade_obra,'São Paulo');assert.equal(row.contract_id,linked.contract_id);
 assert.deepEqual((await db.query('select admin_convert_commercial_record($1) data',[record])).rows[0].data,linked);
 assert.equal((await db.query('select count(*) n from projetos')).rows[0].n,1);assert.equal((await db.query('select count(*) n from contratos')).rows[0].n,1);
 const project2=await draft(id(1),{...input,name:'Segundo projeto',quote_number:'ORC-LEGADO'});
 const quote=id(300);await db.query("insert into commercial_records(id,record_kind,linked_client_id,prospect_name,quote_number,total_value,services,status,quote_document_id,contract_master_version)values($1,'orcamento',$2,'Cliente A','ORC-A',12000,'[]','orcamento_gerado',$3,4)",[quote,id(1),id(400)]);
 const quoted=await contract(payload,[quote],project2);
 assert.equal((await db.query('select assert_commercial_contract_quote_consistency($1) data',[quoted])).rows[0].data.consistent,true);
 const bad=id(301);await db.query("insert into commercial_records(id,record_kind,linked_client_id)values($1,'orcamento',$2)",[bad,id(2)]);
 await assert.rejects(()=>contract(payload,[bad],project2),/mesmo cliente/);
 await db.query('update commercial_records set linked_client_id=null where id=$1',[bad]);await assert.rejects(()=>contract(payload,[bad],project2),/mesmo cliente/);
 await db.exec("select set_config('test.admin','false',false)");await assert.rejects(()=>draft(id(1)),/administrativo/);
 assert.equal((await db.query('select count(*) n from projetos')).rows[0].n,0,'Cliente não ganha acesso às linhas administrativas');
 console.log('PASS: projeto sem contrato/orçamento; cliente ativo; endereço e acesso preservados; contrato posterior reutiliza projeto; orçamento opcional; repetição sem duplicação; bloqueio de vínculos cruzados e de não administradores.');
}finally{await db.close();}
