-- RG do cliente: cadastro e contrato.
-- clientes.rg é a fonte; commercial_records.rg acompanha o cadastro enquanto o contrato
-- não é emitido de novo (documentos emitidos são cópias congeladas e não mudam).

alter table public.clientes add column if not exists rg text;
alter table public.commercial_records add column if not exists rg text;

-- Registro comercial recebe o RG do cliente vinculado quando não tiver um próprio.
create or replace function private.commercial_record_fill_rg()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if nullif(btrim(coalesce(new.rg, '')), '') is null and new.linked_client_id is not null then
    select nullif(btrim(c.rg), '') into new.rg from public.clientes c where c.id = new.linked_client_id;
  end if;
  return new;
end $f$;
revoke all on function private.commercial_record_fill_rg() from public, anon, authenticated;
drop trigger if exists a00_commercial_record_fill_rg on public.commercial_records;
create trigger a00_commercial_record_fill_rg
  before insert or update of linked_client_id, rg on public.commercial_records
  for each row execute function private.commercial_record_fill_rg();

-- RG alterado no cadastro do cliente atualiza os contratos dele que ainda não estão cancelados
-- (quando o contrato estava vazio ou com o RG antigo).
create or replace function private.client_rg_to_commercial_records()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.rg is distinct from old.rg then
    update public.commercial_records r set rg = nullif(btrim(new.rg), '')
     where r.linked_client_id = new.id and r.status <> 'cancelado'
       and (nullif(btrim(coalesce(r.rg, '')), '') is null or r.rg is not distinct from old.rg);
  end if;
  return new;
end $f$;
revoke all on function private.client_rg_to_commercial_records() from public, anon, authenticated;
drop trigger if exists zz_client_rg_to_commercial_records on public.clientes;
create trigger zz_client_rg_to_commercial_records
  after update of rg on public.clientes
  for each row execute function private.client_rg_to_commercial_records();
