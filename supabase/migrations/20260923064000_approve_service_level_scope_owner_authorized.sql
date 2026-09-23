-- Aprovação expressa da titular em 23/09/2026:
-- "contrato mestre aprovado, pode aplicar todas as alterações que fizemos em standby".
-- Libera a matriz Serviço x Bronze/Prata/Ouro após validação automática de completude.
do $migration$
declare
  v_total integer;
  v_pending integer;
  v_invalid integer;
  v_approved integer;
begin
  select count(*),count(*) filter(where review_status='pending')
  into v_total,v_pending
  from public.service_level_scope_catalog
  where active=true;

  if v_total<>114 or v_pending<>114 then
    raise exception 'Matriz mudou desde a aprovação: total %, pendentes %. Revisão manual necessária',v_total,v_pending;
  end if;

  select count(*) into v_invalid
  from public.service_level_scope_catalog
  where active=true
    and (
      nullif(btrim(coalesce(budget_description,'')),'') is null
      or nullif(btrim(coalesce(contract_scope,'')),'') is null
      or nullif(btrim(coalesce(annex_scope,'')),'') is null
      or jsonb_typeof(included_deliverables)<>'array'
      or jsonb_array_length(included_deliverables)=0
      or jsonb_typeof(excluded_deliverables)<>'array'
      or lower(coalesce(budget_description,'')||' '||coalesce(contract_scope,'')||' '||coalesce(annex_scope,'')) ~
         '(aqui.{0,30}descr|inserir.{0,20}descr|preencher.{0,20}atividade|a definir)'
    );

  if v_invalid>0 then
    raise exception 'Existem % combinações incompletas/placeholder; aprovação cancelada',v_invalid;
  end if;

  insert into public.service_level_scope_versions(
    service_code,level_code,version,snapshot,created_by,created_at
  )
  select
    m.service_code,m.level_code,m.version,
    to_jsonb(m)||jsonb_build_object(
      'review_reason','state_before_owner_approval_2026-09-23',
      'reviewed_at',now()
    ),
    null,now()
  from public.service_level_scope_catalog m
  where m.active=true
  on conflict(service_code,level_code,version) do nothing;

  update public.service_level_scope_catalog
  set review_status='approved',
      version=version+1,
      updated_at=now()
  where active=true and review_status='pending';

  get diagnostics v_approved=row_count;
  if v_approved<>114 then
    raise exception 'Esperadas 114 aprovações, gravadas %; operação revertida',v_approved;
  end if;

  insert into public.service_level_scope_versions(
    service_code,level_code,version,snapshot,created_by,created_at
  )
  select
    m.service_code,m.level_code,m.version,
    to_jsonb(m)||jsonb_build_object(
      'review_reason','owner_approved_all_standby_changes_2026-09-23',
      'reviewed_at',now()
    ),
    null,now()
  from public.service_level_scope_catalog m
  where m.active=true
  on conflict(service_code,level_code,version) do nothing;

  insert into public.audit_log(user_id,action,entity_type,details)
  values(
    null,
    'approve_all_service_level_scopes_owner_authorized',
    'service_level_scope_catalog',
    jsonb_build_object(
      'approved_rows',v_approved,
      'contract_master_version',4,
      'owner_authorized',true,
      'approval_date','2026-09-23',
      'automatic_completeness_gate_passed',true,
      'placeholders',0
    )
  );
end
$migration$;
