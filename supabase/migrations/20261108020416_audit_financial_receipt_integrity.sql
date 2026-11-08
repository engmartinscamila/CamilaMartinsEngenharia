-- A02/A03. Candidate: do not apply until backup/restore and environment parity
-- gates are satisfied. No historical row is rewritten or deleted.
begin;

create or replace function private.guard_financial_origin_and_receipt()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projetos; c public.contratos; expected_client uuid;
begin
  if tg_op in ('UPDATE','DELETE') then
    if exists(select 1 from public.payment_receipts where financial_entry_id=old.id) then
      if tg_op='DELETE' then
        raise exception 'Recebimento com recibo emitido não pode ser excluído. Preserve o original e utilize correção rastreável.' using errcode='23514';
      end if;
      if (to_jsonb(new)-array['observacoes','categoria']) is distinct from (to_jsonb(old)-array['observacoes','categoria']) then
        raise exception 'Recebimento com recibo emitido não admite alteração material. Preserve o original e utilize correção rastreável.' using errcode='23514';
      end if;
    end if;
    if tg_op='DELETE' then return old; end if;
  end if;
  if new.projeto_id is not null then
    select * into p from public.projetos where id=new.projeto_id for share;
    if not found then raise exception 'Projeto financeiro não encontrado.' using errcode='23503'; end if;
    expected_client:=p.cliente_id;
  end if;
  if new.contract_id is not null then
    select * into c from public.contratos where id=new.contract_id for share;
    if not found then raise exception 'Contrato financeiro não encontrado.' using errcode='23503'; end if;
    if expected_client is not null and expected_client is distinct from c.cliente_id then
      raise exception 'Cliente, contrato e projeto financeiros incompatíveis.' using errcode='23514';
    end if;
    if p.contract_id is not null and p.contract_id is distinct from c.id then
      raise exception 'Contrato financeiro incompatível com o projeto.' using errcode='23514';
    end if;
    expected_client:=c.cliente_id;
  end if;
  if new.cliente_id is not null and expected_client is not null and new.cliente_id is distinct from expected_client then
    raise exception 'Cliente financeiro incompatível com o projeto/contrato.' using errcode='23514';
  end if;
  new.cliente_id:=coalesce(new.cliente_id,expected_client);
  if new.cliente_id is null then raise exception 'Identifique o cliente do lançamento financeiro.' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function private.guard_financial_origin_and_receipt() from public,anon,authenticated;
create or replace trigger audit_financial_origin_receipt_guard
before insert or update or delete on public.financeiro
for each row execute function private.guard_financial_origin_and_receipt();

create or replace function private.guard_receipt_financial_equivalence()
returns trigger language plpgsql security definer set search_path='' as $$
declare f public.financeiro; expected_client uuid;
begin
  if tg_op='DELETE' then raise exception 'Recibo emitido é imutável e deve permanecer no histórico.' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    if (to_jsonb(new)-'financial_entry_id') is distinct from (to_jsonb(old)-'financial_entry_id')
      or (old.financial_entry_id is not null and new.financial_entry_id is distinct from old.financial_entry_id) then
      raise exception 'Recibo emitido é imutável; não altere o documento nem seu recebimento.' using errcode='23514';
    end if;
  end if;
  -- The existing issuer inserts the snapshot before linking cash, in the same
  -- transaction. Allow only that first link; never unlink or relink a receipt.
  if new.financial_entry_id is null then return new; end if;
  select * into f from public.financeiro where id=new.financial_entry_id for update;
  if not found then raise exception 'Recebimento do recibo não encontrado.' using errcode='23503'; end if;
  select coalesce(f.cliente_id,p.cliente_id) into expected_client
    from (select 1) x left join public.projetos p on p.id=f.projeto_id;
  if f.tipo is distinct from 'entrada' or lower(coalesce(f.status,'')) not in ('pago','recebido','quitado')
    or f.valor is distinct from new.amount or coalesce(f.data_pagamento,f.data) is distinct from new.paid_on
    or f.projeto_id is distinct from new.project_id or expected_client is distinct from new.client_id
    or trim(f.descricao) is distinct from new.description then
    raise exception 'O recebimento não corresponde ao documento emitido.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_receipt_financial_equivalence() from public,anon,authenticated;
create or replace trigger audit_receipt_equivalence_guard
before insert or update or delete on public.payment_receipts
for each row execute function private.guard_receipt_financial_equivalence();

create or replace function private.guard_financial_parent_origin()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='projetos' then
    if exists(select 1 from public.financeiro f
      left join public.contratos c on c.id=f.contract_id
      where f.projeto_id=old.id and (
        (f.cliente_id is not null and f.cliente_id is distinct from new.cliente_id)
        or (c.id is not null and c.cliente_id is distinct from new.cliente_id)
        or (new.contract_id is not null and f.contract_id is not null and f.contract_id is distinct from new.contract_id)))
      or exists(select 1 from public.payment_receipts r where r.project_id=old.id and r.client_id is distinct from new.cliente_id) then
      raise exception 'A alteração do projeto invalidaria seu histórico financeiro/documental.' using errcode='23514';
    end if;
  else
    if exists(select 1 from public.financeiro f left join public.projetos p on p.id=f.projeto_id
      where f.contract_id=old.id and (
        (f.cliente_id is not null and f.cliente_id is distinct from new.cliente_id)
        or (p.id is not null and p.cliente_id is distinct from new.cliente_id))) then
      raise exception 'A alteração do contrato invalidaria seu histórico financeiro.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_financial_parent_origin() from public,anon,authenticated;
create or replace trigger audit_project_financial_origin_guard
before update of cliente_id,contract_id on public.projetos
for each row execute function private.guard_financial_parent_origin();
create or replace trigger audit_contract_financial_origin_guard
before update of cliente_id on public.contratos
for each row execute function private.guard_financial_parent_origin();
commit;
