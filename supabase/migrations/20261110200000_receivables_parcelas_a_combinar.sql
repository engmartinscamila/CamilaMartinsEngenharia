-- Contrato com parcelas a combinar (commercial_terms.payment_to_be_agreed e nenhuma parcela
-- registrada): o Financeiro não mantém lançamentos previstos de uma versão anterior. Parcelas
-- ainda em aberto são canceladas com nota; parcelas pagas ficam intactas e são registradas no
-- audit_log. Quando as parcelas forem definidas, a sincronização normal as reativa.
do $mig$
declare
  v_src text;
  v_anchor text := E'  snap := d.generated_data->''commercial_record_snapshot'';\n';
  v_block text := $blk$
  if coalesce((snap#>>'{commercial_terms,payment_to_be_agreed}')::boolean, false)
     and coalesce(jsonb_array_length(case when jsonb_typeof(snap#>'{commercial_terms,installments}')='array' then snap#>'{commercial_terms,installments}' end), 0) = 0
     and coalesce(jsonb_array_length(case when jsonb_typeof(snap->'payment_terms')='array' then snap->'payment_terms' end), 0) = 0 then
    for m in select * from public.contract_receivable_installments
             where commercial_record_id = r.id and status = 'active' loop
      select * into f from public.financeiro where id = m.financial_entry_id;
      if found and f.status in ('previsto','pendente','atrasado') then
        update public.financeiro set status = 'cancelado',
          observacoes = coalesce(observacoes || ' ', '') || '[Cancelado: parcelas a combinar na revisão v'||coalesce(d.versao,'')||']'
         where id = f.id;
        update public.contract_receivable_installments set status = 'cancelled', updated_at = now() where id = m.id;
        v_cancelled := v_cancelled + 1;
      elsif found then
        insert into public.audit_log(user_id, action, entity_type, entity_id, details)
        values (auth.uid(), 'contract_receivable_paid_removed', 'financeiro', f.id,
                jsonb_build_object('installment', m.installment_no, 'document_id', d.id));
      end if;
    end loop;
    insert into public.audit_log(user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'contract_receivables_to_be_agreed', 'commercial_records', r.id,
            jsonb_build_object('contract_id', r.linked_contract_id, 'document_id', d.id, 'version', d.versao, 'cancelled', v_cancelled));
    return jsonb_build_object('status','a_combinar','cancelled',v_cancelled);
  end if;
$blk$;
begin
  select prosrc into v_src from pg_proc where oid = 'private.sync_contract_receivables(uuid)'::regprocedure;
  if v_src like '%contract_receivables_to_be_agreed%' then return; end if;
  if (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'Ponto de inserção não encontrado exatamente uma vez em sync_contract_receivables.';
  end if;
  v_src := replace(v_src, v_anchor, v_anchor || v_block);
  execute format('create or replace function private.sync_contract_receivables(p_record_id uuid) returns jsonb language plpgsql security definer set search_path to %L as %L', '', v_src);
end
$mig$;
