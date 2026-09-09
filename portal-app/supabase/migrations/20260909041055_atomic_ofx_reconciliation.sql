-- Atomic, conservative reconciliation. No existing records or policies are changed.
create or replace function public.reconcile_imported_ofx(p_account_id uuid, p_external_ids text[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bank_row public.bank_transactions%rowtype;
  financial_row public.financeiro%rowtype;
  candidates uuid[];
  reverse_count integer;
  reconciled integer := 0;
begin
  if auth.uid() is null or not coalesce(public.is_portal_admin(), false) then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;
  if p_external_ids is null or cardinality(p_external_ids) > 2000 then
    raise exception 'Selecione até 2000 transações por importação.' using errcode = '22023';
  end if;
  -- Serialize imports for this account; RLS and the caller's privileges still apply.
  perform 1 from public.financial_accounts where id = p_account_id and active for update;
  if not found then raise exception 'Conta indisponível.' using errcode = '42501'; end if;
  for bank_row in
    select b.* from public.bank_transactions b
    where b.account_id = p_account_id and b.external_id = any(p_external_ids)
      and b.matched_financial_id is null and b.transaction_type in ('credit','debit')
    order by b.id for update
  loop
    select array_agg(f.id) into candidates from public.financeiro f
    where f.bank_transaction_id is null and f.account_id = p_account_id
      and f.tipo = case when bank_row.transaction_type = 'credit' then 'entrada' else 'saida' end
      and f.valor = abs(bank_row.amount)
      and abs(coalesce(f.data, f.data_vencimento) - bank_row.transaction_date) <= 3
      and lower(coalesce(f.status,'')) not in ('cancelado','cancelada')
      and not exists (select 1 from public.bank_transactions linked where linked.matched_financial_id = f.id);
    if coalesce(cardinality(candidates),0) <> 1 then continue; end if;
    select * into financial_row from public.financeiro where id = candidates[1] for update;
    if financial_row.bank_transaction_id is not null then continue; end if;
    -- A second bank transaction with the same possible payment is ambiguous too.
    select count(*) into reverse_count from public.bank_transactions b
    where b.account_id = p_account_id and b.matched_financial_id is null
      and b.transaction_type = bank_row.transaction_type and abs(b.amount) = financial_row.valor
      and abs(b.transaction_date - coalesce(financial_row.data,financial_row.data_vencimento)) <= 3;
    if reverse_count <> 1 then continue; end if;
    if exists (select 1 from public.financeiro f where f.bank_transaction_id = bank_row.id) then continue; end if;
    update public.bank_transactions set matched_financial_id = financial_row.id
      where id = bank_row.id and matched_financial_id is null;
    if not found then raise exception 'A transação foi alterada. Atualize o extrato.'; end if;
    update public.financeiro set bank_transaction_id = bank_row.id
      where id = financial_row.id and bank_transaction_id is null;
    if not found then raise exception 'O lançamento foi alterado. Atualize o financeiro.'; end if;
    reconciled := reconciled + 1;
  end loop;
  return reconciled;
end;
$$;
revoke all on function public.reconcile_imported_ofx(uuid,text[]) from public, anon;
grant execute on function public.reconcile_imported_ofx(uuid,text[]) to authenticated;
