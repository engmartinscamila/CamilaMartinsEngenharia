-- CAMILA MARTINS ENGENHARIA | FINANCEIRO V2 | CANDIDATO PARA HOMOLOGAÇÃO
-- Não executar em produção antes de backup testado, reconciliação do legado,
-- validação de permissões e integração do UI. Adição isolada: não toca financeiro
-- nem payment_receipts. Copiar para supabase/migrations APÓS aceite.
begin;

create table public.fin_v2_receivables (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  request_payload jsonb not null,
  client_id uuid not null references public.clientes(id) on delete restrict,
  contract_id uuid references public.contratos(id) on delete restrict,
  project_id uuid references public.projetos(id) on delete restrict,
  amount numeric(14,2) not null check(amount>0),
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table public.fin_v2_installments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.fin_v2_receivables(id) on delete restrict,
  installment_no integer not null check(installment_no>0),
  amount numeric(14,2) not null check(amount>0),
  due_date date not null,
  created_at timestamptz not null default now(),
  unique(receivable_id,installment_no)
);

create table public.fin_v2_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  request_payload jsonb not null,
  client_id uuid not null references public.clientes(id) on delete restrict,
  account_id uuid references public.financial_accounts(id) on delete restrict,
  amount numeric(14,2) not null check(amount>0),
  paid_on date not null,
  payment_method text not null check(length(btrim(payment_method)) between 2 and 80),
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table public.fin_v2_allocations (
  payment_id uuid not null references public.fin_v2_payments(id) on delete restrict,
  installment_id uuid not null references public.fin_v2_installments(id) on delete restrict,
  amount numeric(14,2) not null check(amount>0),
  created_at timestamptz not null default now(),
  primary key(payment_id,installment_id)
);

create table public.fin_v2_reversals (
  payment_id uuid primary key references public.fin_v2_payments(id) on delete restrict,
  request_id uuid not null unique,
  reason text not null check(length(btrim(reason)) between 3 and 2000),
  reversed_at timestamptz not null default now(),
  reversed_by uuid not null
);

create index fin_v2_receivables_client_idx on public.fin_v2_receivables(client_id);
create index fin_v2_receivables_contract_idx on public.fin_v2_receivables(contract_id);
create index fin_v2_installments_due_idx on public.fin_v2_installments(due_date);
create index fin_v2_payments_client_paid_idx on public.fin_v2_payments(client_id,paid_on);
create index fin_v2_allocations_installment_idx on public.fin_v2_allocations(installment_id);

alter table public.fin_v2_receivables enable row level security;
alter table public.fin_v2_installments enable row level security;
alter table public.fin_v2_payments enable row level security;
alter table public.fin_v2_allocations enable row level security;
alter table public.fin_v2_reversals enable row level security;

-- Leitura administrativa autenticada apenas. Mutação apenas por RPC verificado.
revoke all on table public.fin_v2_receivables,public.fin_v2_installments,
  public.fin_v2_payments,public.fin_v2_allocations,public.fin_v2_reversals from public,anon,authenticated;
grant select on table public.fin_v2_receivables,public.fin_v2_installments,
  public.fin_v2_payments,public.fin_v2_allocations,public.fin_v2_reversals to authenticated;

create policy fin_v2_receivables_read on public.fin_v2_receivables for select to authenticated using ((select public.is_portal_admin()));
create policy fin_v2_installments_read on public.fin_v2_installments for select to authenticated using ((select public.is_portal_admin()));
create policy fin_v2_payments_read on public.fin_v2_payments for select to authenticated using ((select public.is_portal_admin()));
create policy fin_v2_allocations_read on public.fin_v2_allocations for select to authenticated using ((select public.is_portal_admin()));
create policy fin_v2_reversals_read on public.fin_v2_reversals for select to authenticated using ((select public.is_portal_admin()));

create or replace function public.admin_fin_v2_create_receivable(p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_client uuid;v_contract uuid;v_project uuid;v_request uuid;
  v_total numeric;v_part numeric;v_scheduled numeric:=0;
  v_id uuid;v_old jsonb;v_item jsonb;v_idx integer:=0;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo obrigatório' using errcode='42501';
  end if;
  v_request:=(p_data->>'request_id')::uuid;
  v_client:=(p_data->>'client_id')::uuid;
  v_contract:=nullif(p_data->>'contract_id','')::uuid;
  v_project:=nullif(p_data->>'project_id','')::uuid;
  v_total:=(p_data->>'amount')::numeric;
  if v_request is null or v_client is null or v_total is null or v_total<=0 or v_total<>round(v_total,2) then
    raise exception 'Solicitação, cliente e valor com duas casas são obrigatórios';
  end if;
  if jsonb_typeof(p_data->'installments') is distinct from 'array' then
    raise exception 'Informe uma lista de parcelas (pode estar vazia)';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fin-rec-'||v_request::text,0));
  select id,request_payload into v_id,v_old from public.fin_v2_receivables where request_id=v_request;
  if found then
    if v_old is distinct from p_data then raise exception 'Solicitação reutilizada com dados diferentes'; end if;
    return v_id;
  end if;
  perform 1 from public.clientes where id=v_client;
  if not found then raise exception 'Cliente inexistente'; end if;
  if v_contract is not null then
    perform 1 from public.contratos where id=v_contract and cliente_id=v_client;
    if not found then raise exception 'Contrato não pertence ao cliente'; end if;
  end if;
  if v_project is not null then
    perform 1 from public.projetos where id=v_project and cliente_id=v_client
      and (v_contract is null or contract_id is null or contract_id=v_contract);
    if not found then raise exception 'Projeto/contrato incompatível com cliente'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(p_data->'installments')
  loop
    v_part:=(v_item->>'amount')::numeric;
    if v_part is null or v_part<=0 or v_part<>round(v_part,2) or
      nullif(v_item->>'due_date','') is null then raise exception 'Parcela inválida'; end if;
    perform (v_item->>'due_date')::date;
    v_scheduled:=v_scheduled+v_part;
  end loop;
  if v_scheduled>v_total then raise exception 'Parcelamento maior que o título'; end if;
  insert into public.fin_v2_receivables(request_id,request_payload,client_id,contract_id,project_id,amount,created_by)
  values(v_request,p_data,v_client,v_contract,v_project,v_total,auth.uid()) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_data->'installments')
  loop
    v_idx:=v_idx+1;
    insert into public.fin_v2_installments(receivable_id,installment_no,amount,due_date)
    values(v_id,v_idx,(v_item->>'amount')::numeric,(v_item->>'due_date')::date);
  end loop;
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'fin_v2_create_receivable','fin_v2_receivables',v_id,jsonb_build_object('amount',v_total,'installments',v_idx));
  return v_id;
end $$;

create or replace function public.admin_fin_v2_record_payment(p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_request uuid;v_client uuid;v_account uuid;v_amount numeric;v_paid date;
 v_id uuid;v_old jsonb;v_items jsonb;v_item jsonb;v_part numeric;
 v_i public.fin_v2_installments;v_owner uuid;v_used numeric;v_sum numeric:=0;
 v_seen uuid[]:='{}'::uuid[];v_installment uuid;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo obrigatório' using errcode='42501'; end if;
 v_request:=(p_data->>'request_id')::uuid;
 v_client:=(p_data->>'client_id')::uuid;
 v_account:=nullif(p_data->>'account_id','')::uuid;
 v_amount:=(p_data->>'amount')::numeric;
 v_paid:=(p_data->>'paid_on')::date;
 v_items:=p_data->'allocations';
 if v_request is null or v_client is null or v_amount is null or v_amount<=0 or v_amount<>round(v_amount,2)
   or v_paid is null or v_paid>(now() at time zone 'America/Sao_Paulo')::date
   or coalesce(length(trim(p_data->>'payment_method')),0)<2 or jsonb_typeof(v_items) is distinct from 'array'
 then raise exception 'Dados do recebimento incompletos ou inválidos'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fin-pay-'||v_request::text,0));
 select id,request_payload into v_id,v_old from public.fin_v2_payments where request_id=v_request;
 if found then
   if v_old is distinct from p_data then raise exception 'Solicitação reutilizada com dados diferentes'; end if;
   return v_id;
 end if;
 perform 1 from public.clientes where id=v_client;
 if not found then raise exception 'Cliente não encontrado'; end if;
 if v_account is not null then
   perform 1 from public.financial_accounts where id=v_account;
   if not found then raise exception 'Conta financeira não encontrada'; end if;
 end if;
 -- Bloquear parcelas por UUID ordenado para serializar pagamentos concorrentes.
 for v_item in select value from jsonb_array_elements(v_items) order by value->>'installment_id'
 loop
   v_installment:=(v_item->>'installment_id')::uuid;
   v_part:=(v_item->>'amount')::numeric;
   if v_installment is null or v_installment=any(v_seen) or v_part is null or v_part<=0 or v_part<>round(v_part,2)
     then raise exception 'Alocação inválida ou duplicada'; end if;
   v_seen:=array_append(v_seen,v_installment);
   select * into v_i from public.fin_v2_installments where id=v_installment for update;
   if not found then raise exception 'Parcela não encontrada'; end if;
   select client_id into v_owner from public.fin_v2_receivables where id=v_i.receivable_id;
   if v_owner is distinct from v_client then raise exception 'Parcela pertence a outro cliente'; end if;
   select coalesce(sum(a.amount),0) into v_used
     from public.fin_v2_allocations a
     where a.installment_id=v_i.id and not exists
       (select 1 from public.fin_v2_reversals r where r.payment_id=a.payment_id);
   if v_used+v_part>v_i.amount then raise exception 'Pagamento excede o saldo da parcela'; end if;
   v_sum:=v_sum+v_part;
 end loop;
 if v_sum>v_amount then raise exception 'Distribuição excede o recebimento'; end if;
 insert into public.fin_v2_payments(request_id,request_payload,client_id,account_id,amount,paid_on,payment_method,created_by)
 values(v_request,p_data,v_client,v_account,v_amount,v_paid,trim(p_data->>'payment_method'),auth.uid())
 returning id into v_id;
 for v_item in select value from jsonb_array_elements(v_items)
 loop
   insert into public.fin_v2_allocations(payment_id,installment_id,amount)
   values(v_id,(v_item->>'installment_id')::uuid,(v_item->>'amount')::numeric);
 end loop;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'fin_v2_record_payment','fin_v2_payments',v_id,jsonb_build_object('amount',v_amount,'allocated',v_sum));
 return v_id;
end $$;

create or replace function public.admin_fin_v2_reverse_payment(p_payment_id uuid,p_request_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.fin_v2_reversals;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo obrigatório' using errcode='42501'; end if;
 if p_payment_id is null or p_request_id is null or length(btrim(coalesce(p_reason,'')))<3
 then raise exception 'Pagamento, solicitação e justificativa são obrigatórios'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fin-rev-'||p_payment_id::text,0));
 select * into v_old from public.fin_v2_reversals where request_id=p_request_id or payment_id=p_payment_id;
 if found then
   if v_old.payment_id=p_payment_id and v_old.request_id=p_request_id and v_old.reason=trim(p_reason) then return p_payment_id; end if;
   raise exception 'Pagamento já estornado ou solicitação reutilizada';
 end if;
 perform 1 from public.fin_v2_payments where id=p_payment_id for update;
 if not found then raise exception 'Pagamento não encontrado'; end if;
 insert into public.fin_v2_reversals(payment_id,request_id,reason,reversed_by)
 values(p_payment_id,p_request_id,trim(p_reason),auth.uid());
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'fin_v2_reverse_payment','fin_v2_payments',p_payment_id,jsonb_build_object('reason',p_reason));
 return p_payment_id;
end $$;

revoke all on function public.admin_fin_v2_create_receivable(jsonb) from public,anon;
revoke all on function public.admin_fin_v2_record_payment(jsonb) from public,anon;
revoke all on function public.admin_fin_v2_reverse_payment(uuid,uuid,text) from public,anon;
grant execute on function public.admin_fin_v2_create_receivable(jsonb) to authenticated;
grant execute on function public.admin_fin_v2_record_payment(jsonb) to authenticated;
grant execute on function public.admin_fin_v2_reverse_payment(uuid,uuid,text) to authenticated;

-- A visualização respeita as políticas RLS dos registros subjacentes.
create view public.fin_v2_installment_balances with (security_invoker=true) as
select i.id,i.receivable_id,i.due_date,i.amount,
  coalesce(sum(a.amount) filter(where v.payment_id is null),0)::numeric(14,2) as received,
  (i.amount-coalesce(sum(a.amount) filter(where v.payment_id is null),0))::numeric(14,2) as remaining
from public.fin_v2_installments i
left join public.fin_v2_allocations a on a.installment_id=i.id
left join public.fin_v2_reversals v on v.payment_id=a.payment_id
group by i.id;
revoke all on public.fin_v2_installment_balances from public,anon;
grant select on public.fin_v2_installment_balances to authenticated;

commit;
