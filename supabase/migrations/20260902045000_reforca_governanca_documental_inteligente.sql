-- Reforca o vinculo entre Contrato Mestre, catalogos e textos inteligentes.
-- A migracao e aditiva: documentos historicos continuam presos aos snapshots originais.

alter table public.document_rule_reviews
  drop constraint if exists document_rule_reviews_source_type_check;

alter table public.document_rule_reviews
  add constraint document_rule_reviews_source_type_check
  check (source_type in ('service','level','text','contract'));

create index if not exists commercial_records_contract_master_id_idx
  on public.commercial_records(contract_master_id);

-- Função de trigger: não deve permanecer disponível como RPC pública.
revoke all on function public.freeze_commercial_document_governance() from public,anon,authenticated;
grant execute on function public.freeze_commercial_document_governance() to service_role;

create or replace function public.document_contract_clause_map(p_body text)
returns jsonb
language sql
immutable
set search_path=public
as $function$
  with lines as (
    select regexp_replace(btrim(raw_line), '[[:space:]]+', ' ', 'g') as line
    from regexp_split_to_table(coalesce(p_body,''), E'\\r?\\n') as split(raw_line)
  ), numbered as (
    select parts[1] as clause_ref, line
    from lines
    cross join lateral regexp_match(line, '^([0-9]+([.][0-9]+)*)[.][[:space:]]*') as matched(parts)
  )
  select coalesce(jsonb_object_agg(clause_ref,line order by clause_ref),'{}'::jsonb)
  from numbered
$function$;

create or replace function public.document_changed_clause_refs(p_old_body text,p_new_body text)
returns text[]
language plpgsql
immutable
set search_path=public
as $function$
declare
  v_old jsonb := public.document_contract_clause_map(p_old_body);
  v_new jsonb := public.document_contract_clause_map(p_new_body);
  v_refs text[];
begin
  if regexp_replace(coalesce(p_old_body,''),'[[:space:]]+',' ','g') =
     regexp_replace(coalesce(p_new_body,''),'[[:space:]]+',' ','g') then
    return '{}'::text[];
  end if;

  select coalesce(array_agg(key order by key),'{}'::text[])
  into v_refs
  from (
    select key
    from jsonb_object_keys(v_old || v_new) key
    where v_old->>key is distinct from v_new->>key
  ) changed;

  return v_refs;
end
$function$;

revoke all on function public.document_contract_clause_map(text) from public,anon,authenticated;
revoke all on function public.document_changed_clause_refs(text,text) from public,anon,authenticated;
grant execute on function public.document_contract_clause_map(text) to service_role;
grant execute on function public.document_changed_clause_refs(text,text) to service_role;

-- Corrige as clausulas que controlam cada texto. As referencias anteriores de
-- prazo e revisoes estavam deslocadas, o que poderia deixar uma mudanca passar
-- sem a revisao de coerencia correspondente.
insert into public.document_text_catalog_versions(
  text_code,version,snapshot,contract_master_version,created_by
)
select code,version,to_jsonb(t),last_contract_master_version,auth.uid()
from public.document_text_catalog t
where code in (
  'proposal_scope_governance','proposal_revision_rule','proposal_timeline_rule',
  'anexo_scope_governance','anexo_revision_rule','acceptance_rule',
  'additional_service_rule','notification_rule','study_prelim_limit',
  'survey_limit','image_authorization_conditions','closing_release_rule'
)
on conflict(text_code,version) do nothing;

with corrected(code,refs) as (
  values
    ('proposal_scope_governance',array['1.1','1.2','1.3']::text[]),
    ('proposal_revision_rule',array['6.1','6.2','6.3','6.4','6.5']::text[]),
    ('proposal_timeline_rule',array['2.1','2.2','2.3','3.6']::text[]),
    ('anexo_scope_governance',array['1.1','1.2','1.3','5.1']::text[]),
    ('anexo_revision_rule',array['6.1','6.2','6.3','6.4','6.5']::text[]),
    ('acceptance_rule',array['6.3','6.5']::text[]),
    ('additional_service_rule',array['1.2','1.3','6.2','6.4','7.2','7.3','21.4']::text[]),
    ('notification_rule',array['2.2','2.3','3.2','3.3','3.4','3.6','6.3','20.1','20.2']::text[]),
    ('study_prelim_limit',array['1.1','1.2','6.2']::text[]),
    ('survey_limit',array['4.1','4.2','4.3']::text[]),
    ('image_authorization_conditions',array['8.1','8.2','13.3','14.1']::text[]),
    ('closing_release_rule',array['12.1','13.1','14.1','16.1','16.2','16.3','16.4']::text[])
), current_master as (
  select version from public.contract_master_versions where active=true order by version desc limit 1
)
update public.document_text_catalog t
set contract_clause_refs=c.refs,
    version=t.version+1,
    last_contract_master_version=(select version from current_master),
    updated_at=now()
from corrected c
where t.code=c.code
  and t.contract_clause_refs is distinct from c.refs;

-- Textos antes fixos no codigo passam a ser governados e versionados no banco.
insert into public.document_text_catalog(
  code,document_kind,title,body,contract_clause_refs,version,active,
  last_contract_master_version,updated_at
)
select seed.code,seed.document_kind,seed.title,seed.body,seed.refs,1,true,master.version,now()
from (
  values
    (
      'level_scope_rule','geral','Limites dos niveis de prestacao',
      'O nivel de prestacao selecionado aplica-se somente aos servicos expressamente marcados como elegiveis. Nenhum nivel acrescenta automaticamente projetos complementares, execucao, gerenciamento, visitas, levantamentos, taxas ou aprovacoes nao previstos no escopo contratado.',
      array['1.5','1.6','1.7','1.8','1.9']::text[]
    ),
    (
      'scope_limits_rule','geral','Limites gerais do escopo',
      'Somente os itens expressamente incluidos na proposta e confirmados no Anexo I integram o escopo. Solicitacoes posteriores, formatos nao previstos ou itens nao contratados serao tratados como servico adicional mediante aprovacao previa.',
      array['1.1','1.2','1.3','5.5','5.6']::text[]
    ),
    (
      'proposal_client_inputs_rule','orcamento','Insumos e definicoes do cliente',
      'O cliente devera fornecer documentos, respostas de briefing, medidas, aprovacoes e demais definicoes necessarias. A falta desses insumos podera suspender ou repercutir no cronograma nos termos do Contrato.',
      array['2.1','2.2','2.3','3.1','3.2','3.3','3.4','3.5','3.6','11.1','11.3']::text[]
    ),
    (
      'anexo_timeline_rule','anexo_i','Prazo e cronograma do Anexo I',
      'O prazo geral e as referencias de planejamento de cada servico obedecem ao Contrato Mestre e as condicoes especificas deste Anexo I. A contagem depende do recebimento dos insumos necessarios, e prazos de orgaos publicos, concessionarias, cartorios e terceiros nao se confundem com o prazo tecnico de elaboracao.',
      array['2.1','2.2','2.3','3.6']::text[]
    )
) seed(code,document_kind,title,body,refs)
cross join lateral (
  select version from public.contract_master_versions where active=true order by version desc limit 1
) master
on conflict(code) do update set
  document_kind=excluded.document_kind,
  title=excluded.title,
  body=excluded.body,
  contract_clause_refs=excluded.contract_clause_refs,
  version=case
    when public.document_text_catalog.document_kind is distinct from excluded.document_kind
      or public.document_text_catalog.title is distinct from excluded.title
      or public.document_text_catalog.body is distinct from excluded.body
      or public.document_text_catalog.contract_clause_refs is distinct from excluded.contract_clause_refs
    then public.document_text_catalog.version+1
    else public.document_text_catalog.version
  end,
  active=true,
  last_contract_master_version=excluded.last_contract_master_version,
  updated_at=now();

insert into public.document_text_catalog_versions(
  text_code,version,snapshot,contract_master_version,created_by
)
select code,version,to_jsonb(t),last_contract_master_version,auth.uid()
from public.document_text_catalog t
on conflict(text_code,version) do nothing;

create or replace function public.current_document_text_snapshot(p_document_kind text)
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,
      'title',t.title,
      'version',t.version,
      'documentKind',t.document_kind,
      'contractClauses',to_jsonb(t.contract_clause_refs),
      'contractMasterVersion',t.last_contract_master_version
    )
  ),'{}'::jsonb)
  from public.document_text_catalog t
  where t.active=true and t.document_kind in (p_document_kind,'geral')
$function$;

create or replace function public.current_document_text_snapshot_all()
returns jsonb
language sql
stable
security definer
set search_path=public
as $function$
  select coalesce(jsonb_object_agg(
    t.code,
    jsonb_build_object(
      'body',t.body,
      'title',t.title,
      'version',t.version,
      'documentKind',t.document_kind,
      'contractClauses',to_jsonb(t.contract_clause_refs),
      'contractMasterVersion',t.last_contract_master_version
    )
  ),'{}'::jsonb)
  from public.document_text_catalog t
  where t.active=true
$function$;

revoke all on function public.current_document_text_snapshot(text) from public,anon,authenticated;
revoke all on function public.current_document_text_snapshot_all() from public,anon,authenticated;
grant execute on function public.current_document_text_snapshot(text) to service_role;
grant execute on function public.current_document_text_snapshot_all() to service_role;

create or replace function public.enqueue_document_text_reviews(
  p_contract_master_version integer,
  p_reason text,
  p_document_kinds text[] default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare v_count integer;
begin
  insert into public.document_rule_reviews(
    contract_master_version,source_type,source_code,clause_refs,reason,status,
    created_at,resolved_at,resolved_by
  )
  select p_contract_master_version,'text',t.code,t.contract_clause_refs,p_reason,'pending',
         now(),null,null
  from public.document_text_catalog t
  where t.active=true
    and (p_document_kinds is null or t.document_kind='geral' or t.document_kind=any(p_document_kinds))
  on conflict(contract_master_version,source_type,source_code) do update set
    clause_refs=excluded.clause_refs,
    reason=excluded.reason,
    status='pending',
    created_at=now(),
    resolved_at=null,
    resolved_by=null;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.enqueue_document_text_reviews(integer,text,text[]) from public,anon,authenticated;
grant execute on function public.enqueue_document_text_reviews(integer,text,text[]) to service_role;

create or replace function public.queue_governance_after_service_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare v_master integer;
begin
  select version into v_master
  from public.contract_master_versions where active=true order by version desc limit 1;
  if v_master is null then return new; end if;

  insert into public.document_rule_reviews(
    contract_master_version,source_type,source_code,clause_refs,reason,status,
    created_at,resolved_at,resolved_by
  ) values (
    v_master,'contract','service:'||new.code,new.contract_clause_refs,
    'O servico foi incluido ou alterado. Confirme se o Contrato Mestre continua cobrindo corretamente esse escopo.',
    'pending',now(),null,null
  )
  on conflict(contract_master_version,source_type,source_code) do update set
    clause_refs=excluded.clause_refs,reason=excluded.reason,status='pending',
    created_at=now(),resolved_at=null,resolved_by=null;

  perform public.enqueue_document_text_reviews(
    v_master,
    'O catalogo de servicos mudou. Revise este texto para confirmar que escopo, limites, prazo e entregaveis continuam coerentes.',
    null
  );
  return new;
end
$function$;

drop trigger if exists queue_governance_after_service_change_trg on public.service_catalog;
drop trigger if exists queue_governance_after_service_insert_trg on public.service_catalog;
drop trigger if exists queue_governance_after_service_update_trg on public.service_catalog;
create trigger queue_governance_after_service_insert_trg
after insert on public.service_catalog
for each row execute function public.queue_governance_after_service_change();
create trigger queue_governance_after_service_update_trg
after update of name,category,level_applicable,description,deliverables,exclusions,
  client_inputs,default_revisions,delivery_formats,acceptance_required,
  planning_reference,contract_clause_refs,active on public.service_catalog
for each row execute function public.queue_governance_after_service_change();

create or replace function public.queue_governance_after_level_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare v_master integer;
begin
  select version into v_master
  from public.contract_master_versions where active=true order by version desc limit 1;
  if v_master is null then return new; end if;

  insert into public.document_rule_reviews(
    contract_master_version,source_type,source_code,clause_refs,reason,status,
    created_at,resolved_at,resolved_by
  ) values (
    v_master,'contract','level:'||new.code,new.contract_clause_refs,
    'O nivel de prestacao foi incluido ou alterado. Confirme se o Contrato Mestre descreve corretamente suas caracteristicas e limites.',
    'pending',now(),null,null
  )
  on conflict(contract_master_version,source_type,source_code) do update set
    clause_refs=excluded.clause_refs,reason=excluded.reason,status='pending',
    created_at=now(),resolved_at=null,resolved_by=null;

  insert into public.document_rule_reviews(
    contract_master_version,source_type,source_code,clause_refs,reason,status,
    created_at,resolved_at,resolved_by
  )
  select v_master,'service',s.code,s.contract_clause_refs,
         'Um nivel de prestacao mudou. Confirme a compatibilidade deste servico elegivel.',
         'pending',now(),null,null
  from public.service_catalog s
  where s.active=true and s.level_applicable=true
  on conflict(contract_master_version,source_type,source_code) do update set
    clause_refs=excluded.clause_refs,reason=excluded.reason,status='pending',
    created_at=now(),resolved_at=null,resolved_by=null;

  perform public.enqueue_document_text_reviews(
    v_master,
    'O catalogo de niveis mudou. Revise este texto para eliminar nomes, beneficios ou limites desatualizados.',
    null
  );
  return new;
end
$function$;

drop trigger if exists queue_governance_after_level_change_trg on public.service_level_catalog;
drop trigger if exists queue_governance_after_level_insert_trg on public.service_level_catalog;
drop trigger if exists queue_governance_after_level_update_trg on public.service_level_catalog;
create trigger queue_governance_after_level_insert_trg
after insert on public.service_level_catalog
for each row execute function public.queue_governance_after_level_change();
create trigger queue_governance_after_level_update_trg
after update of label,subtitle,description,features,exclusions,contract_clause_refs,active
on public.service_level_catalog
for each row execute function public.queue_governance_after_level_change();

revoke all on function public.queue_governance_after_service_change() from public,anon,authenticated;
revoke all on function public.queue_governance_after_level_change() from public,anon,authenticated;

create or replace function public.admin_publish_contract_master(
  p_body text,
  p_label text,
  p_notes text default null,
  p_changed_clause_refs text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_id uuid;
  v_version integer;
  v_old public.contract_master_versions%rowtype;
  v_manual_refs text[];
  v_detected_refs text[];
  v_effective_refs text[];
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessario'; end if;
  if nullif(btrim(p_body),'') is null then raise exception 'O texto do Contrato Mestre e obrigatorio'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'Informe um nome para a nova versao'; end if;

  select * into v_old
  from public.contract_master_versions where active=true order by version desc limit 1;

  if v_old.id is not null and
     regexp_replace(v_old.body,'[[:space:]]+',' ','g') = regexp_replace(p_body,'[[:space:]]+',' ','g') then
    raise exception 'O texto informado e igual ao Contrato Mestre ativo. Nenhuma nova versao foi criada';
  end if;

  select coalesce(array_agg(distinct btrim(ref) order by btrim(ref)),'{}'::text[])
  into v_manual_refs
  from unnest(coalesce(p_changed_clause_refs,'{}'::text[])) ref
  where nullif(btrim(ref),'') is not null;

  v_detected_refs := case
    when v_old.id is null then '{}'::text[]
    else public.document_changed_clause_refs(v_old.body,p_body)
  end;

  select coalesce(array_agg(distinct ref order by ref),'{}'::text[])
  into v_effective_refs
  from unnest(coalesce(v_manual_refs,'{}'::text[]) || coalesce(v_detected_refs,'{}'::text[])) ref;

  select coalesce(max(version),0)+1 into v_version from public.contract_master_versions;
  update public.contract_master_versions set active=false where active=true;

  insert into public.contract_master_versions(version,label,body,notes,active,created_by)
  values(v_version,btrim(p_label),p_body,nullif(btrim(p_notes),''),true,auth.uid())
  returning id into v_id;

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'service',s.code,s.contract_clause_refs,
    case when cardinality(v_effective_refs)=0
      then 'Nova versao do contrato publicada; revisar coerencia geral do servico.'
      else 'Clausula contratual relacionada ao servico foi alterada automaticamente.' end
  from public.service_catalog s
  where s.active=true and (cardinality(v_effective_refs)=0 or s.contract_clause_refs && v_effective_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'level',l.code,l.contract_clause_refs,
    case when cardinality(v_effective_refs)=0
      then 'Nova versao do contrato publicada; revisar coerencia geral do nivel.'
      else 'Clausula contratual relacionada ao nivel foi alterada automaticamente.' end
  from public.service_level_catalog l
  where l.active=true and (cardinality(v_effective_refs)=0 or l.contract_clause_refs && v_effective_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  insert into public.document_rule_reviews(contract_master_version,source_type,source_code,clause_refs,reason)
  select v_version,'text',t.code,t.contract_clause_refs,
    case when cardinality(v_effective_refs)=0
      then 'Nova versao do contrato publicada; revisar coerencia geral do texto.'
      else 'Clausula contratual relacionada ao texto foi alterada automaticamente.' end
  from public.document_text_catalog t
  where t.active=true and (cardinality(v_effective_refs)=0 or t.contract_clause_refs && v_effective_refs)
  on conflict(contract_master_version,source_type,source_code) do nothing;

  -- Itens sem interseção com as cláusulas efetivamente alteradas são
  -- promovidos automaticamente: não exigem um clique de revisão sem motivo.
  if cardinality(v_effective_refs)>0 then
    update public.service_catalog
    set last_contract_master_version=v_version
    where active=true and not (contract_clause_refs && v_effective_refs);

    update public.service_level_catalog
    set last_contract_master_version=v_version
    where active=true and not (contract_clause_refs && v_effective_refs);

    update public.document_text_catalog
    set last_contract_master_version=v_version
    where active=true and not (contract_clause_refs && v_effective_refs);
  end if;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'publish_contract_master','contract_master_versions',v_id,
    jsonb_build_object(
      'version',v_version,
      'label',p_label,
      'manual_clause_refs',to_jsonb(v_manual_refs),
      'detected_clause_refs',to_jsonb(v_detected_refs),
      'effective_clause_refs',to_jsonb(v_effective_refs),
      'general_review',cardinality(v_effective_refs)=0
    ));

  return v_id;
end
$function$;

create or replace function public.admin_confirm_document_rule_review(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare v_review public.document_rule_reviews%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessario'; end if;
  select * into v_review
  from public.document_rule_reviews
  where id=p_review_id and status='pending';
  if not found then return false; end if;

  update public.document_rule_reviews
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where id=p_review_id;

  if v_review.source_type='service' then
    update public.service_catalog
    set last_contract_master_version=v_review.contract_master_version
    where code=v_review.source_code;
  elsif v_review.source_type='level' then
    update public.service_level_catalog
    set last_contract_master_version=v_review.contract_master_version
    where code=v_review.source_code;
  elsif v_review.source_type='text' then
    update public.document_text_catalog
    set last_contract_master_version=v_review.contract_master_version
    where code=v_review.source_code;
  end if;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'confirm_document_rule_review','document_rule_reviews',v_review.id,
    jsonb_build_object(
      'contract_master_version',v_review.contract_master_version,
      'source_type',v_review.source_type,
      'source_code',v_review.source_code,
      'confirmed_without_change',true
    ));
  return true;
end
$function$;

create or replace function public.admin_document_governance_status()
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_contract jsonb;
  v_master integer;
  v_pending integer;
  v_outdated_services integer;
  v_outdated_levels integer;
  v_outdated_texts integer;
  v_missing_refs integer;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessario'; end if;

  select to_jsonb(c)-'body',c.version into v_contract,v_master
  from public.contract_master_versions c
  where c.active=true order by c.version desc limit 1;

  select count(*) into v_pending
  from public.document_rule_reviews
  where contract_master_version=v_master and status='pending';

  select count(*) into v_outdated_services
  from public.service_catalog where active=true and last_contract_master_version is distinct from v_master;
  select count(*) into v_outdated_levels
  from public.service_level_catalog where active=true and last_contract_master_version is distinct from v_master;
  select count(*) into v_outdated_texts
  from public.document_text_catalog where active=true and last_contract_master_version is distinct from v_master;

  select
    (select count(*) from public.service_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.service_level_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.document_text_catalog where active=true and cardinality(contract_clause_refs)=0)
  into v_missing_refs;

  return jsonb_build_object(
    'contract',coalesce(v_contract,'{}'::jsonb),
    'pending_reviews',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.source_type,r.source_code)
      from public.document_rule_reviews r
      where r.status='pending' and r.contract_master_version=v_master
    ),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.code) from public.service_catalog s where s.active=true),'[]'::jsonb),
    'levels',coalesce((select jsonb_agg(to_jsonb(l) order by l.code) from public.service_level_catalog l where l.active=true),'[]'::jsonb),
    'texts',coalesce((select jsonb_agg(to_jsonb(t) order by t.document_kind,t.code) from public.document_text_catalog t where t.active=true),'[]'::jsonb),
    'preflight',jsonb_build_object(
      'ready',v_master is not null and v_pending=0 and v_outdated_services=0 and
              v_outdated_levels=0 and v_outdated_texts=0 and v_missing_refs=0,
      'pending_total',v_pending,
      'pending_by_type',coalesce((
        select jsonb_object_agg(source_type,total)
        from (
          select source_type,count(*) total
          from public.document_rule_reviews
          where contract_master_version=v_master and status='pending'
          group by source_type
        ) grouped
      ),'{}'::jsonb),
      'outdated_services',v_outdated_services,
      'outdated_levels',v_outdated_levels,
      'outdated_texts',v_outdated_texts,
      'items_without_clause_refs',v_missing_refs
    )
  );
end
$function$;

create or replace function public.assert_document_governance_ready()
returns void
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_master integer;
  v_pending integer;
  v_outdated integer;
  v_missing_refs integer;
  v_missing_texts integer;
begin
  select version into v_master
  from public.contract_master_versions where active=true order by version desc limit 1;
  if v_master is null then
    raise exception 'Nenhum Contrato Mestre ativo foi encontrado';
  end if;

  select count(*) into v_pending
  from public.document_rule_reviews
  where contract_master_version=v_master and status='pending';

  select
    (select count(*) from public.service_catalog where active=true and last_contract_master_version is distinct from v_master) +
    (select count(*) from public.service_level_catalog where active=true and last_contract_master_version is distinct from v_master) +
    (select count(*) from public.document_text_catalog where active=true and last_contract_master_version is distinct from v_master)
  into v_outdated;

  select
    (select count(*) from public.service_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.service_level_catalog where active=true and cardinality(contract_clause_refs)=0) +
    (select count(*) from public.document_text_catalog where active=true and cardinality(contract_clause_refs)=0)
  into v_missing_refs;

  select count(*) into v_missing_texts
  from unnest(array[
    'proposal_scope_governance','proposal_revision_rule','proposal_timeline_rule',
    'proposal_client_inputs_rule','anexo_scope_governance','anexo_revision_rule',
    'anexo_timeline_rule','acceptance_rule','additional_service_rule','notification_rule',
    'study_prelim_limit','survey_limit','image_authorization_conditions',
    'closing_release_rule','level_scope_rule','scope_limits_rule'
  ]) required(code)
  where not exists(
    select 1 from public.document_text_catalog t where t.code=required.code and t.active=true
  );

  if v_pending>0 or v_outdated>0 or v_missing_refs>0 or v_missing_texts>0 then
    raise exception
      'Governanca documental incompleta para o Contrato Mestre v%: % revisao(oes) pendente(s), % item(ns) desatualizado(s), % item(ns) sem clausula vinculada e % texto(s) obrigatorio(s) ausente(s). Revise em Configuracoes antes de criar ou gerar documentos.',
      v_master,v_pending,v_outdated,v_missing_refs,v_missing_texts;
  end if;
end
$function$;

create or replace function public.validate_commercial_governance_selection()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_level text := lower(nullif(btrim(coalesce(new.experience_level,'')),''));
  v_has_service boolean;
  v_has_eligible boolean;
  v_has_level_snapshot boolean;
  v_incomplete integer;
begin
  select exists(
    select 1 from jsonb_array_elements(coalesce(new.services,'[]'::jsonb)) item
    where coalesce((item->>'included')::boolean,false)=true
  ) into v_has_service;

  select exists(
    select 1 from jsonb_array_elements(coalesce(new.services,'[]'::jsonb)) item
    where coalesce((item->>'included')::boolean,false)=true
      and coalesce((item->>'levelApplicable')::boolean,false)=true
  ) into v_has_eligible;

  if not v_has_service and nullif(btrim(coalesce(new.custom_service,'')),'') is null then
    raise exception 'Selecione ao menos um servico ou descreva um servico personalizado';
  end if;
  if v_has_eligible and v_level is null then
    raise exception 'Selecione um nivel de prestacao para os servicos elegiveis';
  end if;
  if v_level is not null and not v_has_eligible then
    raise exception 'O nivel de prestacao somente pode ser usado quando houver servico elegivel selecionado';
  end if;

  select count(*) into v_incomplete
  from jsonb_array_elements(coalesce(new.services,'[]'::jsonb)) item
  where coalesce((item->>'included')::boolean,false)=true
    and (
      nullif(btrim(item->>'code'),'') is null
      or nullif(btrim(item->>'name'),'') is null
      or nullif(btrim(item->>'description'),'') is null
      or nullif(item->>'catalogVersion','') is null
    );
  if v_incomplete>0 then
    raise exception 'Ha servico selecionado sem snapshot completo do catalogo. Atualize o catalogo e tente novamente';
  end if;

  if v_level is not null then
    select exists(
      select 1 from jsonb_array_elements(coalesce(new.services,'[]'::jsonb)) item
      where coalesce((item->>'included')::boolean,false)=true
        and coalesce((item->>'levelApplicable')::boolean,false)=true
        and item->'level'->>'code'=v_level
        and nullif(item->'level'->>'catalogVersion','') is not null
    ) into v_has_level_snapshot;
    if not v_has_level_snapshot then
      raise exception 'O nivel selecionado nao possui snapshot completo. Salve novamente o nivel e tente de novo';
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists zz_validate_commercial_governance_insert_trg on public.commercial_records;
create trigger zz_validate_commercial_governance_insert_trg
before insert on public.commercial_records
for each row execute function public.validate_commercial_governance_selection();

drop trigger if exists zz_validate_commercial_governance_update_trg on public.commercial_records;
create trigger zz_validate_commercial_governance_update_trg
before update of experience_level,services,custom_service on public.commercial_records
for each row execute function public.validate_commercial_governance_selection();

revoke all on function public.validate_commercial_governance_selection() from public,anon,authenticated;

revoke all on function public.admin_publish_contract_master(text,text,text,text[]) from public,anon;
revoke all on function public.admin_confirm_document_rule_review(uuid) from public,anon;
revoke all on function public.admin_document_governance_status() from public,anon;
revoke all on function public.assert_document_governance_ready() from public,anon;
grant execute on function public.admin_publish_contract_master(text,text,text,text[]) to authenticated;
grant execute on function public.admin_confirm_document_rule_review(uuid) to authenticated;
grant execute on function public.admin_document_governance_status() to authenticated;
grant execute on function public.assert_document_governance_ready() to authenticated,service_role;
grant execute on function public.enrich_commercial_services(jsonb,text) to authenticated,service_role;
