-- Corrige o preparo de documentos que não dependem de aprovação e repara
-- snapshots legados ainda editáveis sem alterar arquivos Word ou extratos.

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.admin_prepare_contract_document(uuid,text,uuid,jsonb)'::regprocedure
  ) into v_definition;

  if position('v_approval public.aprovacoes%rowtype;' in v_definition) = 0 then
    if position('v_approval record;' in v_definition) = 0 then
      raise exception 'Declaração de aprovação do admin_prepare_contract_document não localizada';
    end if;

    v_definition := replace(
      v_definition,
      'v_approval record;',
      'v_approval public.aprovacoes%rowtype;'
    );
    execute v_definition;
  end if;
end
$migration$;

with active_master as (
  select id,version
  from public.contract_master_versions
  where active=true
  order by version desc
  limit 1
)
update public.documentos d
set generated_data = coalesce(d.generated_data,'{}'::jsonb)
  || jsonb_build_object(
    'contract_master_id',m.id,
    'contract_master_version',m.version,
    'governance_repaired_at',now(),
    'governance_repair_reason','legacy_missing_snapshot'
  )
  || case
    when coalesce(d.generated_data->'smart_texts','{}'::jsonb)='{}'::jsonb
      then jsonb_build_object('smart_texts',public.current_document_text_snapshot_all())
    else '{}'::jsonb
  end
from active_master m
where d.document_kind is not null
  and d.workflow_status in ('rascunho','gerado')
  and (
    d.generated_data->>'contract_master_version' is null
    or btrim(d.generated_data->>'contract_master_version')=''
  );

revoke all on function public.admin_prepare_contract_document(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_prepare_contract_document(uuid,text,uuid,jsonb) to authenticated;
