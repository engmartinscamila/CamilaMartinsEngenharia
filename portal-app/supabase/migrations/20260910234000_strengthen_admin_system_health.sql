create or replace function public.admin_system_health()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_missing_snapshots bigint;
  v_unknown_kinds bigint;
  v_wrong_quote bigint;
  v_wrong_contract bigint;
  v_missing_quote bigint;
  v_missing_contract bigint;
  v_rls_missing bigint;
  v_invalid_schedule_weights bigint;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;

  select count(*) into v_missing_snapshots from public.documentos d
  where d.workflow_status in ('gerado','enviado','aceito','assinado') and d.document_kind is not null
    and not exists (select 1 from public.document_emission_snapshots s where s.document_id=d.id);
  select count(*) into v_unknown_kinds from public.documentos d
  where d.document_kind is not null and d.document_kind not in ('anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico','servico_adicional','autorizacao_imagem','quitacao_encerramento','notificacao_formal','orcamento','contrato');
  select
    count(*) filter (where cr.quote_document_id is not null and coalesce(dq.document_kind,'') <> 'orcamento'),
    count(*) filter (where cr.contract_document_id is not null and coalesce(dc.document_kind,'') <> 'contrato'),
    count(*) filter (where cr.quote_document_id is not null and dq.id is null),
    count(*) filter (where cr.contract_document_id is not null and dc.id is null)
  into v_wrong_quote,v_wrong_contract,v_missing_quote,v_missing_contract
  from public.commercial_records cr
  left join public.documentos dq on dq.id=cr.quote_document_id
  left join public.documentos dc on dc.id=cr.contract_document_id;
  select count(*) into v_rls_missing from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname in ('clientes','projetos','documentos','fotos','solicitacoes','aprovacoes','construction_schedules','construction_schedule_items') and not c.relrowsecurity;
  select count(*) into v_invalid_schedule_weights from (
    select cs.id from public.construction_schedules cs join public.construction_schedule_items i on i.schedule_id=cs.id
    group by cs.id having abs(sum(i.weight_percent)-100)>0.01
  ) q;

  select jsonb_build_object(
    'database','ok','checked_at',now(),
    'documents_total',(select count(*) from public.documentos),
    'snapshots_total',(select count(*) from public.document_emission_snapshots),
    'legacy_snapshots',(select count(*) from public.document_emission_snapshots where legacy_backfill),
    'sha256_snapshots',(select count(*) from public.document_emission_snapshots where hash_algorithm='sha256' and length(snapshot_hash)=64),
    'pending_acceptances',(select count(*) from public.documentos where workflow_status='enviado'),
    'latest_document_generated_at',(select max(generated_at) from public.documentos),
    'latest_snapshot_at',(select max(emitted_at) from public.document_emission_snapshots),
    'documents_missing_snapshot',v_missing_snapshots,'unknown_document_kinds',v_unknown_kinds,
    'wrong_quote_links',v_wrong_quote,'wrong_contract_links',v_wrong_contract,
    'missing_quote_documents',v_missing_quote,'missing_contract_documents',v_missing_contract,
    'critical_rls_missing',v_rls_missing,
    'construction_schedules',(select count(*) from public.construction_schedules),
    'construction_schedule_items',(select count(*) from public.construction_schedule_items),
    'construction_schedule_weight_warnings',v_invalid_schedule_weights,
    'critical_issues',v_missing_snapshots+v_unknown_kinds+v_wrong_quote+v_wrong_contract+v_missing_quote+v_missing_contract+v_rls_missing
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.admin_system_health() from public;
revoke execute on function public.admin_system_health() from anon;
grant execute on function public.admin_system_health() to authenticated;
