-- Atualiza a constraint estrutural do cronograma para reconhecer o caminho
-- já governado de contratação posterior por Serviço Adicional aceito.
-- O fluxo original continua exigindo quote_record_id + contract_record_id.

alter table public.construction_schedules
drop constraint if exists construction_schedule_activation_valid;

alter table public.construction_schedules
add constraint construction_schedule_activation_valid
check (
  activation_status in ('legacy','draft','approved')
  and (
    activation_status='legacy'
    or (
      quote_record_id is not null
      and contract_record_id is not null
    )
    or (
      quote_record_id is null
      and contract_record_id is null
      and source_scope_snapshot->>'authorization_type'='servico_adicional_aceito'
      and nullif(source_scope_snapshot->>'source_document_id','') is not null
    )
  )
);
