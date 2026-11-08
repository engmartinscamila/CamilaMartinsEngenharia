-- Compras/suprimentos: uma cotação é criada atomicamente com seu primeiro item.
-- Somente operações administrativas; nenhuma migração de valores e nenhum registro apagado.
begin;
alter table public.purchase_quotes add column if not exists client_request_id uuid;
create unique index if not exists purchase_quotes_request_unique
 on public.purchase_quotes(client_request_id) where client_request_id is not null;

create or replace function public.admin_create_purchase_quote(
 p_request_id uuid, p_project_id uuid, p_title text, p_description text,
 p_due_date date, p_item_description text, p_quantity numeric, p_unit text
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_title text:=btrim(coalesce(p_title,''));
 v_item text:=btrim(coalesce(p_item_description,''));
 v_unit text:=btrim(coalesce(p_unit,''));
 v_description text:=nullif(btrim(coalesce(p_description,'')),'');
 v_prior public.purchase_quotes%rowtype;
 v_id uuid;
begin
 if v_user is null or not public.is_portal_admin() then
  raise exception 'Acesso administrativo obrigatório' using errcode='42501';
 end if;
 if p_request_id is null or p_project_id is null or length(v_title) not between 3 and 180
  or length(v_item) not between 2 and 500 or length(v_unit) not between 1 and 30
  or p_quantity is null or p_quantity<=0 or p_quantity>1000000000
  or scale(p_quantity)>4 or length(coalesce(p_description,''))>10000 then
  raise exception 'Preencha projeto, título, item, quantidade e unidade válidos';
 end if;
 if not exists(select 1 from public.projetos where id=p_project_id) then
  raise exception 'Projeto inexistente';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('purchase-quote:'||p_request_id::text,0));
 select * into v_prior from public.purchase_quotes
 where client_request_id=p_request_id for update;
 if found then
  if v_prior.project_id=p_project_id and v_prior.title=v_title
   and v_prior.description is not distinct from v_description
   and v_prior.due_date is not distinct from p_due_date
   and exists(select 1 from public.purchase_quote_items i where i.quote_id=v_prior.id
    and i.description=v_item and i.quantity=p_quantity and i.unit=v_unit)
  then return v_prior.id; end if;
  raise exception 'Solicitação já utilizada com dados diferentes';
 end if;
 insert into public.purchase_quotes
 (project_id,title,description,due_date,status,created_by,client_request_id)
 values(p_project_id,v_title,v_description,p_due_date,'collecting',v_user,p_request_id)
 returning id into v_id;
 insert into public.purchase_quote_items(quote_id,description,quantity,unit,position)
 values(v_id,v_item,p_quantity,v_unit,0);
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(v_user,'purchase_quote_created','purchase_quotes',v_id,
  jsonb_build_object('request_id',p_request_id,'project_id',p_project_id,'item_quantity',p_quantity,'unit',v_unit));
 return v_id;
end
$fn$;

create or replace function public.admin_register_supplier_bid(
 p_quote_id uuid,p_supplier_id uuid,p_total_amount numeric,
 p_lead_time_days integer,p_payment_terms text,p_notes text
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_quote public.purchase_quotes%rowtype;
 v_bid uuid;
 v_terms text:=nullif(btrim(coalesce(p_payment_terms,'')),'');
begin
 if v_user is null or not public.is_portal_admin() then
  raise exception 'Acesso administrativo obrigatório' using errcode='42501';
 end if;
 if p_quote_id is null or p_supplier_id is null or p_total_amount is null
  or p_total_amount<0 or p_total_amount>1000000000000 or scale(p_total_amount)>2
  or p_lead_time_days is not null and p_lead_time_days<0
  or v_terms is null or length(v_terms)>250 or length(coalesce(p_notes,''))>2000 then
  raise exception 'Preencha fornecedor, valor, prazo e condições válidos';
 end if;
 select * into v_quote from public.purchase_quotes where id=p_quote_id for update;
 if not found then raise exception 'Cotação não localizada';end if;
 if v_quote.status not in ('draft','collecting','analysis') then
  raise exception 'Cotação aprovada, pedida ou cancelada não aceita alteração de proposta';
 end if;
 if not exists(select 1 from public.suppliers where id=p_supplier_id and active=true) then
  raise exception 'Fornecedor inexistente ou inativo';
 end if;
 insert into public.supplier_bids(quote_id,supplier_id,total_amount,lead_time_days,payment_terms,notes)
 values(p_quote_id,p_supplier_id,p_total_amount,p_lead_time_days,v_terms,nullif(btrim(coalesce(p_notes,'')),''))
 on conflict (quote_id,supplier_id) do update
 set total_amount=excluded.total_amount,lead_time_days=excluded.lead_time_days,
 payment_terms=excluded.payment_terms,notes=excluded.notes,updated_at=now()
 returning id into v_bid;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(v_user,'supplier_bid_registered','supplier_bids',v_bid,
  jsonb_build_object('quote_id',p_quote_id,'supplier_id',p_supplier_id,'amount',p_total_amount));
 return v_bid;
end
$fn$;

create or replace function public.admin_approve_supplier_bid(
 p_quote_id uuid,p_supplier_id uuid
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=auth.uid();
 v_quote public.purchase_quotes%rowtype;
 v_bid uuid;
begin
 if v_user is null or not public.is_portal_admin() then
  raise exception 'Acesso administrativo obrigatório' using errcode='42501';
 end if;
 if p_quote_id is null or p_supplier_id is null then
  raise exception 'Informe a cotação e o fornecedor';
 end if;
 select * into v_quote from public.purchase_quotes where id=p_quote_id for update;
 if not found then raise exception 'Cotação não localizada';end if;
 if v_quote.status='approved' and v_quote.selected_supplier_id=p_supplier_id then
  return v_quote.id; -- reenvio idempotente: nenhum segundo evento.
 end if;
 if v_quote.status not in ('draft','collecting','analysis') then
  raise exception 'Cotação já concluída. Nova escolha exige revisão explícita';
 end if;
 select b.id into v_bid from public.supplier_bids b
 join public.suppliers s on s.id=b.supplier_id and s.active=true
 where b.quote_id=p_quote_id and b.supplier_id=p_supplier_id;
 if v_bid is null then raise exception 'Fornecedor não apresentou proposta válida para esta cotação';end if;
 update public.purchase_quotes
 set selected_supplier_id=p_supplier_id,status='approved',updated_at=now()
 where id=p_quote_id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(v_user,'supplier_bid_approved','purchase_quotes',p_quote_id,
  jsonb_build_object('supplier_id',p_supplier_id,'bid_id',v_bid));
 return p_quote_id;
end
$fn$;
revoke all on function public.admin_create_purchase_quote(uuid,uuid,text,text,date,text,numeric,text) from public,anon;
revoke all on function public.admin_register_supplier_bid(uuid,uuid,numeric,integer,text,text) from public,anon;
revoke all on function public.admin_approve_supplier_bid(uuid,uuid) from public,anon;
grant execute on function public.admin_create_purchase_quote(uuid,uuid,text,text,date,text,numeric,text) to authenticated;
grant execute on function public.admin_register_supplier_bid(uuid,uuid,numeric,integer,text,text) to authenticated;
grant execute on function public.admin_approve_supplier_bid(uuid,uuid) to authenticated;
commit;
