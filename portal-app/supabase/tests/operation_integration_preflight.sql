-- Homologação: valida os novos módulos e desfaz todos os dados de teste ao final.
begin;

create temporary table test_ids(name text primary key,value uuid) on commit drop;
create temporary table test_results(label text,value integer) on commit drop;
grant select,insert,update,delete on test_ids,test_results to authenticated;

select set_config('request.jwt.claims','{"sub":"84f82ede-6de7-43ef-a75e-bfdc04effc22","role":"authenticated"}',true);
set local role authenticated;

with x as (
  insert into public.documentos(cliente_id,projeto_id,contract_id,nome,arquivo,categoria,client_visible,exibir_cliente,client_released_at)
  select p.cliente_id,p.id,p.contract_id,'Documento de teste transacional','test/transaction.pdf','Teste',true,true,now()
  from public.projetos p where p.id='30000000-0000-4000-8000-000000000001' returning id
) insert into test_ids select 'document',id from x;
with x as (
  insert into public.project_tasks(project_id,title,status,start_date,due_date,client_visible,weight)
  values('30000000-0000-4000-8000-000000000001','Tarefa principal transacional','doing',current_date,current_date+2,true,2) returning id
) insert into test_ids select 'task1',id from x;
with x as (
  insert into public.project_tasks(project_id,title,status,parent_task_id,due_date,client_visible)
  values('30000000-0000-4000-8000-000000000001','Subtarefa transacional','todo',(select value from test_ids where name='task1'),current_date+3,true) returning id
) insert into test_ids select 'task2',id from x;
insert into public.project_task_dependencies(task_id,depends_on_task_id)
values((select value from test_ids where name='task2'),(select value from test_ids where name='task1'));

with x as (insert into public.task_templates(name) values('Modelo transacional') returning id)
insert into test_ids select 'template',id from x;
insert into public.task_template_items(template_id,title,offset_days,duration_days)
values((select value from test_ids where name='template'),'Item do modelo transacional',1,2);
insert into test_results values(
  'template_applied',
  public.admin_apply_task_template((select value from test_ids where name='template'),'30000000-0000-4000-8000-000000000001',current_date)
);

insert into public.work_diary_entries(project_id,activities,weather,team_count,client_visible)
values('30000000-0000-4000-8000-000000000001','Atividade transacional completa','Ensolarado',3,true);
with x as (insert into public.suppliers(name,category) values('Fornecedor transacional','Materiais') returning id)
insert into test_ids select 'supplier',id from x;
with x as (insert into public.purchase_quotes(project_id,title,status) values('30000000-0000-4000-8000-000000000001','Cotação transacional','collecting') returning id)
insert into test_ids select 'quote',id from x;
insert into public.purchase_quote_items(quote_id,description,quantity,unit)
values((select value from test_ids where name='quote'),'Concreto',5,'m³');
insert into public.supplier_bids(quote_id,supplier_id,total_amount,lead_time_days)
values((select value from test_ids where name='quote'),(select value from test_ids where name='supplier'),5000,3);
update public.purchase_quotes set selected_supplier_id=(select value from test_ids where name='supplier'),status='approved'
where id=(select value from test_ids where name='quote');

with x as (insert into public.financial_accounts(name,account_type) values('Conta transacional','bank') returning id)
insert into test_ids select 'account',id from x;
with x as (
  insert into public.bank_transactions(account_id,external_id,transaction_date,description,amount,transaction_type)
  values((select value from test_ids where name='account'),'TRANS-1',current_date,'Recebimento transacional',1000,'credit') returning id
) insert into test_ids select 'bank',id from x;
with x as (
  insert into public.financeiro(projeto_id,descricao,tipo,valor,data,categoria,status,data_vencimento,account_id,bank_transaction_id)
  values('30000000-0000-4000-8000-000000000001','Receita transacional','entrada',1000,current_date,'honorarios','pago',current_date,(select value from test_ids where name='account'),(select value from test_ids where name='bank')) returning id
) insert into test_ids select 'finance',id from x;
update public.bank_transactions set matched_financial_id=(select value from test_ids where name='finance')
where id=(select value from test_ids where name='bank');
insert into public.timesheets(project_id,work_date,hours,hourly_cost,description)
values('30000000-0000-4000-8000-000000000001',current_date,2,150,'Coordenação transacional');
insert into public.fiscal_documents(project_id,status,description,amount)
values('30000000-0000-4000-8000-000000000001','ready','Serviço transacional',1000);

with x as (
  insert into public.commercial_records(quote_number,prospect_name,quote_document_id,created_by,services,custom_service)
  values('ORC-TRANS-0001','Prospect transacional',(select value from test_ids where name='document'),'84f82ede-6de7-43ef-a75e-bfdc04effc22','[]'::jsonb,'Validação transacional') returning id
) insert into test_ids select 'commercial',id from x;
insert into test_results
select 'prospect_token_length',length(public.admin_create_prospect_access_link((select value from test_ids where name='commercial'),24));
insert into test_results
select 'automation_ok',case when (public.admin_run_operational_reminders()->>'run_id') is not null then 1 else 0 end;
insert into test_results select 'admin_tasks',count(*) from public.project_tasks where project_id='30000000-0000-4000-8000-000000000001';
insert into test_results select 'financial_summary',count(*) from public.project_financial_summary where project_id='30000000-0000-4000-8000-000000000001';
reset role;

select set_config('request.jwt.claims','{"sub":"ce4df708-488f-4535-b20c-5ab8422e782e","role":"authenticated"}',true);
set local role authenticated;
insert into test_results select 'client_a_tasks_visible',count(*) from public.project_tasks where title like '%transacional%';
insert into test_results select 'client_a_diary_visible',count(*) from public.work_diary_entries where activities like '%transacional%';
insert into test_results select 'client_a_document_visible',count(*) from public.documentos where nome='Documento de teste transacional';
reset role;

select set_config('request.jwt.claims','{"sub":"a7dac5e3-1580-45b5-856e-b11825d28151","role":"authenticated"}',true);
set local role authenticated;
insert into test_results select 'client_b_tasks_blocked',count(*) from public.project_tasks where title like '%transacional%';
insert into test_results select 'client_b_diary_blocked',count(*) from public.work_diary_entries where activities like '%transacional%';
insert into test_results select 'client_b_document_blocked',count(*) from public.documentos where nome='Documento de teste transacional';
reset role;

select set_config('request.jwt.claims','{"sub":"84f82ede-6de7-43ef-a75e-bfdc04effc22","role":"authenticated"}',true);
set local role authenticated;
update public.project_portal_settings set show_documents=false,show_tasks=false,show_work_diary=false
where project_id='30000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims','{"sub":"ce4df708-488f-4535-b20c-5ab8422e782e","role":"authenticated"}',true);
set local role authenticated;
insert into test_results select 'hidden_tasks_blocked',count(*) from public.project_tasks where title like '%transacional%';
insert into test_results select 'hidden_diary_blocked',count(*) from public.work_diary_entries where activities like '%transacional%';
insert into test_results select 'hidden_document_blocked',count(*) from public.documentos where nome='Documento de teste transacional';
reset role;

do $$
declare r record;
begin
  for r in select * from test_results loop
    if r.label in ('template_applied','automation_ok','financial_summary','client_a_diary_visible','client_a_document_visible') and r.value<>1 then
      raise exception 'FALHA %: esperado 1, obtido %',r.label,r.value;
    end if;
    if r.label='prospect_token_length' and r.value<>48 then raise exception 'FALHA token: %',r.value; end if;
    if r.label='admin_tasks' and r.value<3 then raise exception 'FALHA tarefas admin: %',r.value; end if;
    if r.label='client_a_tasks_visible' and r.value<>2 then raise exception 'FALHA tarefas cliente A: %',r.value; end if;
    if r.label in ('client_b_tasks_blocked','client_b_diary_blocked','client_b_document_blocked','hidden_tasks_blocked','hidden_diary_blocked','hidden_document_blocked') and r.value<>0 then
      raise exception 'FALHA isolamento %: esperado 0, obtido %',r.label,r.value;
    end if;
  end loop;
end
$$;

select * from test_results order by label;
rollback;
