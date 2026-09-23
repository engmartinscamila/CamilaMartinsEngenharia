-- Preserva a versão inicial e toda revisão subsequente da matriz serviço x nível.

insert into public.service_level_scope_versions(
  service_code,level_code,version,snapshot,created_by,created_at
)
select
  m.service_code,
  m.level_code,
  m.version,
  to_jsonb(m)||jsonb_build_object(
    'review_reason','initial_catalog_draft',
    'reviewed_at',m.updated_at
  ),
  null,
  m.updated_at
from public.service_level_scope_catalog m
on conflict (service_code,level_code,version) do nothing;

create or replace function public.admin_review_service_level_scope(
  p_service_code text,
  p_level_code text,
  p_decision text,
  p_reason text,
  p_budget_description text default null,
  p_contract_scope text default null,
  p_annex_scope text default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_current public.service_level_scope_catalog%rowtype;
  v_updated public.service_level_scope_catalog%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_budget text;
  v_contract text;
  v_annex text;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if v_decision not in ('pending','approved','rejected') then
    raise exception 'Decisão inválida';
  end if;

  if v_reason is null or length(v_reason)<5 then
    raise exception 'Informe uma justificativa objetiva para a revisão';
  end if;

  select * into v_current
  from public.service_level_scope_catalog
  where service_code=btrim(p_service_code)
    and level_code=lower(btrim(p_level_code))
    and active=true
  for update;

  if not found then
    raise exception 'Combinação serviço x nível não encontrada';
  end if;

  v_budget := coalesce(nullif(btrim(p_budget_description),''),v_current.budget_description);
  v_contract := coalesce(nullif(btrim(p_contract_scope),''),v_current.contract_scope);
  v_annex := coalesce(nullif(btrim(p_annex_scope),''),v_current.annex_scope);

  if v_decision='approved' and (
    v_budget is null or length(v_budget)<20 or
    v_contract is null or length(v_contract)<20 or
    v_annex is null or length(v_annex)<20
  ) then
    raise exception 'Para aprovar, revise os três textos: orçamento, contrato e Anexo I';
  end if;

  insert into public.service_level_scope_versions(
    service_code,level_code,version,snapshot,created_by,created_at
  ) values (
    v_current.service_code,
    v_current.level_code,
    v_current.version,
    to_jsonb(v_current)||jsonb_build_object(
      'review_reason','state_before_review',
      'reviewed_at',now()
    ),
    auth.uid(),
    now()
  )
  on conflict (service_code,level_code,version) do nothing;

  update public.service_level_scope_catalog
  set budget_description=v_budget,
      contract_scope=v_contract,
      annex_scope=v_annex,
      review_status=v_decision,
      version=v_current.version+1,
      updated_at=now()
  where service_code=v_current.service_code
    and level_code=v_current.level_code
  returning * into v_updated;

  insert into public.service_level_scope_versions(
    service_code,level_code,version,snapshot,created_by
  ) values (
    v_updated.service_code,
    v_updated.level_code,
    v_updated.version,
    to_jsonb(v_updated)||jsonb_build_object(
      'review_reason',v_reason,
      'reviewed_at',now()
    ),
    auth.uid()
  );

  insert into public.audit_log(user_id,action,entity_type,details)
  values(
    auth.uid(),
    'review_service_level_scope',
    'service_level_scope_catalog',
    jsonb_build_object(
      'service_code',v_updated.service_code,
      'level_code',v_updated.level_code,
      'decision',v_decision,
      'reason',v_reason,
      'previous_version',v_current.version,
      'version',v_updated.version
    )
  );

  return v_updated.version;
end;
$$;

revoke all on function public.admin_review_service_level_scope(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.admin_review_service_level_scope(text,text,text,text,text,text,text) to authenticated;
