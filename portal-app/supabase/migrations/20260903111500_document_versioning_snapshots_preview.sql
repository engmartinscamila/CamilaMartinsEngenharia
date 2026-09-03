alter table public.documentos add column if not exists revision_of uuid references public.documentos(id) on delete set null;
alter table public.documentos add column if not exists version_reason text;
alter table public.documentos add column if not exists snapshot_frozen_at timestamptz;
create index if not exists idx_documentos_revision_of on public.documentos(revision_of);
create index if not exists idx_documentos_project_kind_version on public.documentos(projeto_id,document_kind,created_at desc);

create table if not exists public.document_emission_snapshots(
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null unique references public.documentos(id) on delete restrict,
 document_kind text,
 version text not null,
 version_reason text,
 snapshot jsonb not null,
 snapshot_hash text not null,
 emitted_at timestamptz not null default now(),
 created_by uuid default auth.uid()
);
alter table public.document_emission_snapshots enable row level security;
drop policy if exists document_emission_snapshots_admin_select on public.document_emission_snapshots;
create policy document_emission_snapshots_admin_select on public.document_emission_snapshots for select to authenticated using (public.is_portal_admin());
revoke all on public.document_emission_snapshots from anon, public;
grant select on public.document_emission_snapshots to authenticated;

create or replace function public.prevent_document_emission_snapshot_mutation() returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'Snapshot de emissão é imutável';
end;
$$;
drop trigger if exists trg_document_emission_snapshots_immutable on public.document_emission_snapshots;
create trigger trg_document_emission_snapshots_immutable before update or delete on public.document_emission_snapshots for each row execute function public.prevent_document_emission_snapshot_mutation();

create or replace function public.assign_document_revision_version() returns trigger language plpgsql set search_path='' as $$
declare
 v_prev public.documentos%rowtype;
 v_major int:=1;
 v_minor int:=0;
 v_bump text;
 v_commercial_record text;
begin
 if new.document_kind is null then return new; end if;
 v_bump:=lower(coalesce(new.generated_data->>'version_bump','minor'));
 v_commercial_record:=new.generated_data->>'commercial_record_id';
 if new.projeto_id is not null then
  select * into v_prev from public.documentos d
  where d.projeto_id=new.projeto_id and d.document_kind=new.document_kind and d.id<>new.id
    and (new.approval_id is null or d.approval_id is not distinct from new.approval_id)
  order by d.created_at desc limit 1;
 elsif v_commercial_record is not null then
  select * into v_prev from public.documentos d
  where d.document_kind=new.document_kind and d.id<>new.id
    and d.generated_data->>'commercial_record_id'=v_commercial_record
  order by d.created_at desc limit 1;
 end if;
 if found then
  begin v_major:=split_part(coalesce(v_prev.versao,'1.0'),'.',1)::int; exception when others then v_major:=1; end;
  begin v_minor:=split_part(coalesce(v_prev.versao,'1.0'),'.',2)::int; exception when others then v_minor:=0; end;
  if v_bump='major' then v_major:=v_major+1;v_minor:=0;else v_minor:=v_minor+1;end if;
  new.revision_of:=v_prev.id;
 else
  v_major:=1;v_minor:=0;new.revision_of:=null;
 end if;
 new.versao:=v_major::text||'.'||v_minor::text;
 new.version_reason:=nullif(btrim(coalesce(new.generated_data->>'version_reason','')),'');
 new.generated_data:=coalesce(new.generated_data,'{}'::jsonb)||jsonb_build_object('document_version',new.versao,'revision_of',new.revision_of,'version_reason',new.version_reason);
 return new;
end;
$$;
drop trigger if exists trg_assign_document_revision_version on public.documentos;
create trigger trg_assign_document_revision_version before insert on public.documentos for each row when (new.document_kind is not null) execute function public.assign_document_revision_version();

create or replace function public.freeze_document_emission_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(new.categoria,'')<>'Comercial' and new.workflow_status='gerado' and old.workflow_status is distinct from 'gerado'
    and not exists(select 1 from public.document_emission_snapshots s where s.document_id=new.id) then
  insert into public.document_emission_snapshots(document_id,document_kind,version,version_reason,snapshot,snapshot_hash,emitted_at,created_by)
  values(new.id,new.document_kind,coalesce(new.versao,'1.0'),new.version_reason,coalesce(new.generated_data,'{}'::jsonb),md5(coalesce(new.generated_data,'{}'::jsonb)::text),coalesce(new.generated_at,now()),auth.uid());
  new.snapshot_frozen_at:=coalesce(new.generated_at,now());
 end if;
 return new;
end;
$$;
drop trigger if exists trg_freeze_document_emission_snapshot on public.documentos;
create trigger trg_freeze_document_emission_snapshot before update of workflow_status,generated_data,generated_at on public.documentos for each row execute function public.freeze_document_emission_snapshot();

create or replace function public.admin_preview_contract_document(p_project_id uuid,p_document_kind text,p_approval_id uuid default null,p_extra_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v record; v_prev record; v_scope jsonb; v_major int:=1; v_minor int:=0;
 v_bump text:=lower(coalesce(p_extra_data->>'version_bump','minor')); v_next text;
begin
 if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário'; end if;
 select p.id,p.nome project_name,p.tipo project_type,p.endereco_obra,p.numero_obra,p.complemento_obra,p.bairro_obra,p.cidade_obra,p.estado_obra,p.contract_id,p.cliente_id,
        c.contract_number,c.contract_value,cl.nome client_name,cl.cpf_cnpj client_cpf_cnpj,cl.endereco client_address
 into v
 from public.projetos p join public.contratos c on c.id=p.contract_id left join public.clientes cl on cl.id=p.cliente_id
 where p.id=p_project_id;
 if not found then raise exception 'Projeto/contrato não encontrado'; end if;
 select d.id,d.versao into v_prev from public.documentos d
 where d.projeto_id=p_project_id and d.document_kind=p_document_kind
   and (p_approval_id is null or d.approval_id is not distinct from p_approval_id)
 order by d.created_at desc limit 1;
 if found then
  begin v_major:=split_part(coalesce(v_prev.versao,'1.0'),'.',1)::int; exception when others then v_major:=1; end;
  begin v_minor:=split_part(coalesce(v_prev.versao,'1.0'),'.',2)::int; exception when others then v_minor:=0; end;
  if v_bump='major' then v_major:=v_major+1;v_minor:=0;else v_minor:=v_minor+1;end if;
 end if;
 v_next:=v_major::text||'.'||v_minor::text;
 select coalesce(jsonb_agg(jsonb_build_object('code',s.service_code,'name',s.service_name,'included',s.included) order by s.display_order),'[]'::jsonb)
 into v_scope from public.contract_scope_items s where s.contract_id=v.contract_id and s.included=true;
 return jsonb_build_object(
  'document_kind',p_document_kind,'next_version',v_next,'revision_of',v_prev.id,
  'client_name',v.client_name,'client_cpf_cnpj',v.client_cpf_cnpj,'client_address',v.client_address,
  'project_name',v.project_name,'project_type',v.project_type,'contract_number',v.contract_number,'contract_value',v.contract_value,
  'property_address',concat_ws(', ',nullif(v.endereco_obra,''),nullif(v.numero_obra,''),nullif(v.complemento_obra,''),nullif(v.bairro_obra,''),nullif(v.cidade_obra,''),nullif(v.estado_obra,'')),
  'scope_items',v_scope,'document_options',coalesce(p_extra_data->'document_options','{}'::jsonb)
 );
end;
$$;
revoke all on function public.admin_preview_contract_document(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_preview_contract_document(uuid,text,uuid,jsonb) to authenticated;