create or replace function public.commercial_contract_use_property_address()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if new.record_kind = 'contrato' and nullif(btrim(coalesce(new.property_address,'')),'') is not null then
    new.address := new.property_address;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commercial_contract_use_property_address on public.commercial_records;
create trigger trg_commercial_contract_use_property_address
before insert or update of record_kind, property_address, address on public.commercial_records
for each row execute function public.commercial_contract_use_property_address();

update public.commercial_records
set address = property_address
where record_kind='contrato'
  and nullif(btrim(coalesce(property_address,'')),'') is not null
  and address is distinct from property_address;
