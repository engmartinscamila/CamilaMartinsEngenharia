-- Camila Martins Engenharia | candidato somente para homologação (NÃO produção).
-- Um comprovante administrativo está vinculado 1:1 a um pagamento V2 confirmado.
-- Não emite recibo fiscal/Word/PDF definitivo, nem insere lançamentos em financeiro.
begin;

create table public.fin_v2_receipt_records(
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  payment_id uuid not null unique references public.fin_v2_payments(id) on delete restrict,
  request_id uuid not null unique,
  immutable_snapshot jsonb not null,
  issued_at timestamptz not null default now(),
  issued_by uuid not null
);
create index fin_v2_receipts_issued_at_idx on public.fin_v2_receipt_records(issued_at);

alter table public.fin_v2_receipt_records enable row level security;
revoke all on public.fin_v2_receipt_records from public,anon,authenticated;
grant select on public.fin_v2_receipt_records to authenticated;
create policy fin_v2_receipts_admin_read on public.fin_v2_receipt_records
  for select to authenticated using ((select public.is_portal_admin()));

create or replace function public.admin_fin_v2_issue_receipt_reference(
 p_payment_id uuid,p_request_id uuid
)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  v_payment public.fin_v2_payments;
  v_previous public.fin_v2_receipt_records;
  v_id uuid;
  v_client_name text;
  v_allocations jsonb;
begin
 if auth.uid() is null or not public.is_portal_admin() then
  raise exception 'Acesso administrativo obrigatório' using errcode='42501';
 end if;
 if p_payment_id is null or p_request_id is null then
  raise exception 'Informe o pagamento e o identificador da solicitação';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('fin-v2-receipt-'||p_payment_id::text,0));
 select * into v_previous
 from public.fin_v2_receipt_records
 where payment_id=p_payment_id or request_id=p_request_id
 for update;
 if found then
  if v_previous.payment_id=p_payment_id and v_previous.request_id=p_request_id then
   return v_previous.id;
  end if;
  raise exception 'Comprovante já vinculado ou identificador da solicitação reutilizado';
 end if;
 select * into v_payment from public.fin_v2_payments where id=p_payment_id for share;
 if not found then raise exception 'Pagamento não encontrado'; end if;
 if exists(select 1 from public.fin_v2_reversals where payment_id=p_payment_id) then
  raise exception 'O pagamento estornado não admite emissão de novo comprovante';
 end if;
 select nome into v_client_name from public.clientes where id=v_payment.client_id;
 if not found then raise exception 'Cliente não encontrado'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'installment_id',a.installment_id,
   'receivable_id',i.receivable_id,
   'amount',a.amount
  ) order by a.installment_id), '[]'::jsonb)
 into v_allocations
 from public.fin_v2_allocations a
 join public.fin_v2_installments i on i.id=a.installment_id
 where a.payment_id=p_payment_id;
 insert into public.fin_v2_receipt_records(payment_id,request_id,immutable_snapshot,issued_by)
 values(p_payment_id,p_request_id,jsonb_build_object(
  'kind','comprovante_administrativo_homologacao',
  'client_id',v_payment.client_id,'client_name',v_client_name,
  'paid_on',v_payment.paid_on,'payment_method',v_payment.payment_method,
  'payment_amount',v_payment.amount,'account_id',v_payment.account_id,
  'payment_id',v_payment.id,'allocations',v_allocations,
  'document_is_final',false
 ),auth.uid())
 returning id into v_id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'fin_v2_issue_receipt_reference','fin_v2_receipt_records',v_id,
  jsonb_build_object('payment_id',p_payment_id,'amount',v_payment.amount));
 return v_id;
end
$function$;

revoke all on function public.admin_fin_v2_issue_receipt_reference(uuid,uuid)
 from public,anon;
grant execute on function public.admin_fin_v2_issue_receipt_reference(uuid,uuid)
 to authenticated;

commit;
