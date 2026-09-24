-- Permite que o guard de criação/revalidação do cronograma reconheça o
-- caminho legítimo de contratação posterior por Serviço Adicional aceito,
-- sem relaxar o fluxo original baseado em orçamento + contrato.

create or replace function public.guard_construction_schedule_creation()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_snapshot jsonb;
  v_source_document_id uuid;
begin
  if tg_op='UPDATE' then
    if new.source_scope_snapshot is distinct from old.source_scope_snapshot then
      raise exception 'Escopo congelado. Alterações exigem nova versão/aditivo';
    end if;
    if old.activation_status='legacy' then
      return new;
    end if;
  elsif new.activation_status='legacy' then
    raise exception 'Novos cronogramas exigem vínculo comercial verificável';
  end if;

  if new.source_scope_snapshot->>'authorization_type'='servico_adicional_aceito' then
    begin
      v_source_document_id:=nullif(new.source_scope_snapshot->>'source_document_id','')::uuid;
    exception when invalid_text_representation then
      raise exception 'Serviço Adicional de origem inválido';
    end;

    if v_source_document_id is null
       or new.quote_record_id is not null
       or new.contract_record_id is not null then
      raise exception 'Vínculo do cronograma por Serviço Adicional está inconsistente';
    end if;

    v_snapshot:=public.assert_full_schedule_additional_service(
      new.project_id,
      v_source_document_id
    );
  else
    v_snapshot:=public.assert_full_schedule_commercial_link(
      new.project_id,
      new.quote_record_id,
      new.contract_record_id
    );
  end if;

  if new.client_id is distinct from (
       select cliente_id from public.projetos where id=new.project_id
     )
     or new.contract_id is distinct from (
       select contract_id from public.projetos where id=new.project_id
     ) then
    raise exception 'Cliente/contrato do cabeçalho divergente do projeto';
  end if;

  if tg_op='INSERT' then
    new.source_scope_snapshot:=v_snapshot;
  elsif v_snapshot is distinct from new.source_scope_snapshot then
    raise exception 'Vínculo comercial mudou; abra uma revisão/aditivo';
  end if;

  return new;
end
$function$;
