-- Confirmação e recibo são uma transação: falha de emissão mantém a parcela pendente.
-- Reutiliza o lançamento e a emissão existentes; não cria receita duplicada.
create or replace function public.admin_receive_payment_with_receipt(
  p_financial_id uuid, p_request_id uuid, p_paid_on date,
  p_payment_method text, p_city text, p_expected_amount numeric
) returns public.payment_receipts
language plpgsql security definer set search_path = '' as $function$
declare
  f public.financeiro;
  r public.payment_receipts;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode='42501';
  end if;
  if p_financial_id is null or p_request_id is null then
    raise exception 'Identifique a parcela e a solicitação.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_financial_id::text,0));
  select * into f from public.financeiro where id=p_financial_id for update;
  if not found or f.tipo is distinct from 'entrada' or f.status='cancelado' then
    raise exception 'Parcela indisponível para recebimento. Atualize o extrato.';
  end if;
  if p_expected_amount is null or f.valor is distinct from p_expected_amount then
    raise exception 'O valor da parcela mudou. Atualize o extrato antes de confirmar.';
  end if;
  select * into r from public.payment_receipts where financial_entry_id=f.id;
  if found then
    if r.reversed_at is not null then raise exception 'Este recebimento foi estornado. Registre o recebimento correto em outro lançamento.'; end if;
    if r.paid_on is distinct from p_paid_on or f.forma_pagamento is distinct from nullif(btrim(p_payment_method),'') then
      raise exception 'Esta parcela já tem recibo com outros dados. Abra o recibo existente.';
    end if;
    return r;
  end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe a data em que o pagamento foi recebido, sem data futura.';
  end if;
  if nullif(btrim(p_payment_method),'') is null then raise exception 'Informe a forma de pagamento.'; end if;
  if f.status not in ('pago','recebido','quitado') then
    if f.bank_transaction_id is not null or exists(select 1 from public.bank_transactions where matched_financial_id=f.id) then
      raise exception 'Este lançamento está conciliado. Confira a conciliação antes de receber.';
    end if;
    update public.financeiro set status='pago',data_pagamento=p_paid_on,forma_pagamento=btrim(p_payment_method) where id=f.id;
  elsif coalesce(f.data_pagamento,f.data) is distinct from p_paid_on or f.forma_pagamento is distinct from btrim(p_payment_method) then
    raise exception 'O recebimento já está registrado com outros dados. Atualize e abra o recibo deste recebimento.';
  end if;
  r:=public.admin_issue_receipt_for_payment(f.id,p_request_id,p_city);
  return r;
end $function$;
revoke all on function public.admin_receive_payment_with_receipt(uuid,uuid,date,text,text,numeric) from public,anon;
grant execute on function public.admin_receive_payment_with_receipt(uuid,uuid,date,text,text,numeric) to authenticated;

-- Corrige a normalização do CPF/CNPJ na função atual sem substituir regras de emissão.
do $repair$
declare definition text;
begin
  select pg_get_functiondef('public.admin_issue_payment_receipt(jsonb)'::regprocedure) into definition;
  definition:=replace(definition, $old$,'\\D','','g')$old$, $new$,'[^0-9]','','g')$new$);
  execute definition;
end $repair$;
