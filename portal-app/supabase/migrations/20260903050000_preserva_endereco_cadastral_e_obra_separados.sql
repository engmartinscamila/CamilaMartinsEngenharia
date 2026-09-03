drop trigger if exists trg_commercial_contract_use_property_address on public.commercial_records;
drop function if exists public.commercial_contract_use_property_address();

comment on column public.commercial_records.address is
  'Endereço cadastral/residencial do contratante. Não deve ser sobrescrito pelo endereço da obra.';

comment on column public.commercial_records.property_address is
  'Endereço do imóvel/obra, referência técnica principal dos documentos do serviço.';
