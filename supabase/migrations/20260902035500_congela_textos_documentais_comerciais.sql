
alter table public.commercial_records
  add column if not exists smart_texts jsonb not null default '{}'::jsonb;

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
      'contractClauses',to_jsonb(t.contract_clause_refs)
    )
  ),'{}'::jsonb)
  from public.document_text_catalog t
  where t.active=true and t.document_kind=p_document_kind
$function$;

create or replace function public.freeze_commercial_document_governance()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_master_id uuid;
  v_master_version integer;
  v_kind text;
begin
  if new.contract_master_id is null or new.contract_master_version is null then
    select id,version into v_master_id,v_master_version
    from public.contract_master_versions
    where active=true
    order by version desc
    limit 1;

    new.contract_master_id := coalesce(new.contract_master_id,v_master_id);
    new.contract_master_version := coalesce(new.contract_master_version,v_master_version);
  end if;

  if new.smart_texts is null or new.smart_texts='{}'::jsonb then
    v_kind := case when coalesce(new.record_kind,'orcamento')='contrato' then 'contrato' else 'orcamento' end;
    new.smart_texts := public.current_document_text_snapshot(v_kind);
  end if;

  return new;
end
$function$;

drop trigger if exists freeze_commercial_document_governance_trg on public.commercial_records;
create trigger freeze_commercial_document_governance_trg
before insert on public.commercial_records
for each row execute function public.freeze_commercial_document_governance();

update public.commercial_records cr
set contract_master_id = cm.id,
    contract_master_version = cm.version,
    smart_texts = case
      when cr.smart_texts='{}'::jsonb
        then public.current_document_text_snapshot(case when cr.record_kind='contrato' then 'contrato' else 'orcamento' end)
      else cr.smart_texts
    end
from public.contract_master_versions cm
where cm.active=true
  and (cr.contract_master_id is null or cr.contract_master_version is null or cr.smart_texts='{}'::jsonb);

revoke all on function public.current_document_text_snapshot(text) from public,anon,authenticated;
grant execute on function public.current_document_text_snapshot(text) to service_role;
