-- Revisão individual da matriz serviço x nível pelo Admin.
-- Sem aprovação em massa; cada decisão exige justificativa e gera versão auditável.

create or replace function public.admin_list_service_level_scope_reviews(
  p_status text default 'pending',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  service_code text,
  service_name text,
  category text,
  professional_scope_check_required boolean,
  level_code text,
  level_label text,
  level_subtitle text,
  review_status text,
  budget_description text,
  contract_scope text,
  annex_scope text,
  included_deliverables jsonb,
  excluded_deliverables jsonb,
  parameters jsonb,
  revisions_included integer,
  visits_included integer,
  detail_level text,
  delivery_formats jsonb,
  version integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text := lower(nullif(btrim(coalesce(p_status,'')),''));
  v_limit integer := least(greatest(coalesce(p_limit,25),1),100);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if v_status is not null and v_status not in ('pending','approved','rejected','all') then
    raise exception 'Status de revisão inválido';
  end if;

  return query
  select
    m.service_code,
    s.name,
    s.category,
    coalesce(s.professional_scope_check_required,false),
    m.level_code,
    l.label,
    l.subtitle,
    m.review_status,
    m.budget_description,
    m.contract_scope,
    m.annex_scope,
    m.included_deliverables,
    m.excluded_deliverables,
    m.parameters,
    m.revisions_included,
    m.visits_included,
    m.detail_level,
    m.delivery_formats,
    m.version,
    m.updated_at
  from public.service_level_scope_catalog m
  join public.service_catalog s on s.code=m.service_code
  join public.service_level_catalog l on l.code=m.level_code
  where m.active=true
    and s.active=true
    and l.active=true
    and (v_status is null or v_status='all' or m.review_status=v_status)
  order by
    case m.review_status when 'pending' then 0 when 'rejected' then 1 else 2 end,
    s.name,
    case m.level_code when 'bronze' then 1 when 'prata' then 2 else 3 end
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_list_service_level_scope_reviews(text,integer,integer) from public,anon;
grant execute on function public.admin_list_service_level_scope_reviews(text,integer,integer) to authenticated;

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
    to_jsonb(v_updated)||jsonb_build_object('review_reason',v_reason,'reviewed_at',now()),
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
      'version',v_updated.version
    )
  );

  return v_updated.version;
end;
$$;

revoke all on function public.admin_review_service_level_scope(text,text,text,text,text,text,text) from public,anon;
grant execute on function public.admin_review_service_level_scope(text,text,text,text,text,text,text) to authenticated;
