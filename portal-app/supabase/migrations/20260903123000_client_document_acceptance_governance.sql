alter table public.documentos
  add column if not exists version text,
  add column if not exists client_visible boolean not null default false,
  add column if not exists exibir_cliente boolean not null default false,
  add column if not exists acceptance_required boolean not null default false,
  add column if not exists client_released_at timestamptz,
  add column if not exists client_released_by uuid,
  add column if not exists valid_from date,
  add column if not exists valid_until date,
  add column if not exists superseded_by uuid references public.documentos(id),
  add column if not exists superseded_at timestamptz,
  add column if not exists replacement_reason text;

do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='documentos' and column_name='versao') then
    execute 'update public.documentos set version=versao where version is null and versao is not null';
  end if;
end $$;

create table if not exists public.document_acceptances(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documentos(id) on delete restrict,
  project_id uuid not null references public.projetos(id) on delete restrict,
  client_id uuid not null references public.clientes(id) on delete restrict,
  user_id uuid not null,
  document_version text not null,
  snapshot_hash text not null,
  decision text not null check(decision in('accepted','accepted_with_notes','rejected')),
  note text,
  source text not null default 'portal' check(source in('web','app','portal')),
  client_context jsonb not null default '{}'::jsonb,
  consent_text_version text not null default '2026-09-03',
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(document_id,user_id)
);

create table if not exists public.document_pending_alerts(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projetos(id) on delete cascade,
  alert_code text not null,
  source_document_id uuid references public.documentos(id) on delete set null,
  title text not null,
  message text not null,
  severity text not null default 'warning' check(severity in('info','warning','critical')),
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);

create unique index if not exists document_pending_alerts_unique_open on public.document_pending_alerts(project_id,alert_code,coalesce(source_document_id,'00000000-0000-0000-0000-000000000000'::uuid)) where resolved_at is null;
create index if not exists document_acceptances_project_idx on public.document_acceptances(project_id,accepted_at desc);
create index if not exists document_pending_alerts_due_idx on public.document_pending_alerts(project_id,due_at) where resolved_at is null;

create or replace function public.user_has_project_access(p_project_id uuid)
returns boolean language sql stable security definer set search_path='public' as $$
  select public.is_portal_admin()
    or exists(select 1 from public.projetos p join public.clientes c on c.id=p.cliente_id where p.id=p_project_id and c.auth_id=auth.uid())
    or exists(select 1 from public.project_members pm where pm.project_id=p_project_id and pm.user_id=auth.uid() and pm.active=true)
$$;

create or replace function public.block_document_acceptance_mutation()
returns trigger language plpgsql set search_path='public' as $$
begin
  raise exception 'Aceites documentais são imutáveis. Emita nova versão para uma nova manifestação.';
end $$;

drop trigger if exists trg_document_acceptance_immutable on public.document_acceptances;
create trigger trg_document_acceptance_immutable before update or delete on public.document_acceptances for each row execute function public.block_document_acceptance_mutation();

create or replace function public.client_accept_document(p_document_id uuid,p_decision text,p_note text default null,p_source text default 'portal',p_client_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='public' as $$
declare d public.documentos%rowtype; v_client uuid; v_hash text; v_id uuid; v_version text;
begin
  if auth.uid() is null then raise exception 'Sessão do cliente necessária.'; end if;
  if p_decision not in('accepted','accepted_with_notes','rejected') then raise exception 'Manifestação inválida.'; end if;
  if p_decision in('accepted_with_notes','rejected') and nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'Informe a observação desta manifestação.'; end if;
  select * into d from public.documentos where id=p_document_id;
  if d.id is null then raise exception 'Documento não encontrado.'; end if;
  if public.is_portal_admin() or not public.user_has_project_access(d.projeto_id) then raise exception 'Aceite permitido somente ao cliente vinculado.'; end if;
  if not(coalesce(d.client_visible,false) or coalesce(d.exibir_cliente,false)) or d.client_released_at is null then raise exception 'Documento ainda não foi liberado ao cliente.'; end if;
  if not coalesce(d.acceptance_required,false) then raise exception 'Este documento não requer aceite.'; end if;
  if d.snapshot_frozen_at is null then raise exception 'Documento ainda não está congelado para aceite.'; end if;
  if d.superseded_by is not null then raise exception 'Esta versão foi substituída.'; end if;
  if d.valid_until is not null and d.valid_until<current_date then raise exception 'Documento expirado.'; end if;
  v_version:=coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0');
  select cliente_id into v_client from public.projetos where id=d.projeto_id;
  select snapshot_hash into v_hash from public.document_emission_snapshots where document_id=d.id order by emitted_at desc limit 1;
  if nullif(v_hash,'') is null then v_hash:=encode(digest(convert_to(coalesce(d.generated_data,'{}'::jsonb)::text||'|'||d.id::text||'|'||v_version,'UTF8'),'sha256'),'hex'); end if;
  insert into public.document_acceptances(document_id,project_id,client_id,user_id,document_version,snapshot_hash,decision,note,source,client_context)
  values(d.id,d.projeto_id,v_client,auth.uid(),v_version,v_hash,p_decision,nullif(btrim(coalesce(p_note,'')),''),case when p_source in('web','app','portal') then p_source else 'portal' end,coalesce(p_client_context,'{}'::jsonb)) returning id into v_id;
  update public.document_pending_alerts set resolved_at=now(),resolution_note='Manifestação do cliente registrada.' where source_document_id=d.id and alert_code='awaiting_document_acceptance' and resolved_at is null;
  insert into public.notificacoes(cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,referencia_tipo,referencia_id)
  values(v_client,d.projeto_id,'Manifestação documental do cliente','Manifestação registrada para '||coalesce(d.nome,'Documento')||' — versão '||v_version||'.','document_acceptance',false,'orcamentos-contratos.html','admin','document_acceptance',v_id::text);
  insert into public.audit_log(user_id,action,entity_type,entity_id,details) values(auth.uid(),'client_document_acceptance','documentos',d.id,jsonb_build_object('acceptance_id',v_id,'decision',p_decision,'version',v_version,'snapshot_hash',v_hash,'source',p_source));
  return v_id;
exception when unique_violation then raise exception 'Você já registrou uma manifestação para esta versão.';
end $$;

create or replace function public.admin_release_document_for_client(p_document_id uuid,p_acceptance_required boolean default true,p_valid_from date default null,p_valid_until date default null)
returns void language plpgsql security definer set search_path='public' as $$
declare d public.documentos%rowtype; v_client uuid; v_version text;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  select * into d from public.documentos where id=p_document_id;
  if d.id is null then raise exception 'Documento não encontrado.'; end if;
  if d.snapshot_frozen_at is null then raise exception 'Emita/congele o documento antes de liberá-lo.'; end if;
  if d.superseded_by is not null then raise exception 'Versão substituída não pode ser liberada.'; end if;
  if p_valid_until is not null and p_valid_from is not null and p_valid_until<p_valid_from then raise exception 'Período de validade inválido.'; end if;
  v_version:=coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0');
  update public.documentos set client_visible=true,exibir_cliente=true,acceptance_required=coalesce(p_acceptance_required,true),client_released_at=now(),client_released_by=auth.uid(),valid_from=coalesce(p_valid_from,current_date),valid_until=p_valid_until where id=p_document_id;
  select cliente_id into v_client from public.projetos where id=d.projeto_id;
  if p_acceptance_required then insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at) values(d.projeto_id,'awaiting_document_acceptance',d.id,'Aceite documental pendente',coalesce(d.nome,'Documento')||' — versão '||v_version||' aguarda manifestação do cliente.','warning',now()+interval '5 days') on conflict do nothing; end if;
  if p_valid_until is not null then insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at) values(d.projeto_id,'document_expiring',d.id,'Validade documental',coalesce(d.nome,'Documento')||' — versão '||v_version||' precisa de revisão de validade.','warning',p_valid_until::timestamptz) on conflict do nothing; end if;
  insert into public.notificacoes(cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,referencia_tipo,referencia_id) values(v_client,d.projeto_id,case when p_acceptance_required then 'Documento disponível para aceite' else 'Novo documento disponível' end,coalesce(d.nome,'Documento')||' — versão '||v_version||' está disponível no portal.','document_release',false,'documentos-cliente.html?projeto='||d.projeto_id::text,'cliente','documento',d.id::text);
end $$;

create or replace function public.admin_supersede_document(p_old_document_id uuid,p_new_document_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='public' as $$
declare o public.documentos%rowtype; n public.documentos%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Informe o motivo da substituição.'; end if;
  select * into o from public.documentos where id=p_old_document_id; select * into n from public.documentos where id=p_new_document_id;
  if o.id is null or n.id is null or o.projeto_id is distinct from n.projeto_id or o.id=n.id then raise exception 'Substituição documental inválida.'; end if;
  update public.documentos set superseded_by=n.id,superseded_at=now(),replacement_reason=btrim(p_reason),client_visible=false,exibir_cliente=false where id=o.id;
  update public.document_pending_alerts set resolved_at=now(),resolution_note='Documento substituído.' where source_document_id=o.id and resolved_at is null;
end $$;

create or replace function public.admin_set_document_validity(p_document_id uuid,p_valid_from date,p_valid_until date)
returns void language plpgsql security definer set search_path='public' as $$
declare d public.documentos%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.'; end if;
  if p_valid_until is not null and p_valid_from is not null and p_valid_until<p_valid_from then raise exception 'Período de validade inválido.'; end if;
  select * into d from public.documentos where id=p_document_id; if d.id is null then raise exception 'Documento não encontrado.'; end if;
  update public.documentos set valid_from=p_valid_from,valid_until=p_valid_until where id=p_document_id;
  update public.document_pending_alerts set resolved_at=now(),resolution_note='Validade atualizada.' where source_document_id=d.id and alert_code='document_expiring' and resolved_at is null;
  if p_valid_until is not null then insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at) values(d.projeto_id,'document_expiring',d.id,'Validade documental',coalesce(d.nome,'Documento')||' precisa de revisão de validade.','warning',p_valid_until::timestamptz) on conflict do nothing; end if;
end $$;

create or replace function public.client_document_map(p_project_id uuid)
returns table(document_id uuid,document_kind text,document_name text,version text,lifecycle_status text,acceptance_required boolean,acceptance_decision text,accepted_at timestamptz,valid_until date,is_current boolean)
language sql stable security definer set search_path='public' as $$
 select d.id,coalesce(nullif(d.document_kind,''),nullif(lower(d.tipo),''),'outro'),coalesce(d.nome,'Documento'),coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0'),
 case when d.superseded_by is not null then 'substituido' when d.valid_until is not null and d.valid_until<current_date then 'expirado' when a.decision='accepted' then 'aceito' when a.decision='accepted_with_notes' then 'aceito_com_ressalvas' when a.decision='rejected' then 'recusado' when d.acceptance_required then 'aguardando_aceite' else 'disponivel' end,
 d.acceptance_required,a.decision,a.accepted_at,d.valid_until,(d.superseded_by is null and(d.valid_until is null or d.valid_until>=current_date))
 from public.documentos d left join lateral(select x.* from public.document_acceptances x where x.document_id=d.id and x.user_id=auth.uid() order by x.accepted_at desc limit 1)a on true
 where d.projeto_id=p_project_id and public.user_has_project_access(p_project_id) and not public.is_portal_admin() and(coalesce(d.client_visible,false) or coalesce(d.exibir_cliente,false)) and d.client_released_at is not null order by d.created_at desc
$$;

create or replace function public.admin_project_document_map(p_project_id uuid)
returns table(document_kind text,label text,required_now boolean,document_id uuid,document_name text,version text,lifecycle_status text,acceptance_required boolean,acceptance_decision text,valid_until date,is_current boolean)
language sql stable security definer set search_path='public' as $$
 with catalog(kind,label,required_now) as(values('orcamento','Orçamento',false),('contrato','Contrato',true),('anexo_i','Anexo I',true),('art','ART',false),('estudo_preliminar','Estudo Preliminar',false),('levantamento_tecnico','Levantamento / Vistoria',false),('termo_aceite','Termo de Aceite',false),('servico_adicional','Serviço Adicional',false),('autorizacao_imagem','Autorização de Imagem',false),('quitacao_encerramento','Quitação / Encerramento',(select lower(coalesce(status,'')) in('concluido','concluído','completed','encerrado') from public.projetos where id=p_project_id)),('notificacao_formal','Notificação Formal',false)),
 latest as(select distinct on(coalesce(nullif(d.document_kind,''),nullif(lower(d.tipo),''))) d.*,coalesce(nullif(d.document_kind,''),nullif(lower(d.tipo),'')) kind_key from public.documentos d where d.projeto_id=p_project_id order by coalesce(nullif(d.document_kind,''),nullif(lower(d.tipo),'')),d.created_at desc),
 acc as(select distinct on(document_id) document_id,decision from public.document_acceptances order by document_id,accepted_at desc)
 select c.kind,c.label,c.required_now,l.id,l.nome,coalesce(nullif(l.version,''),to_jsonb(l)->>'versao','1.0'),case when l.id is null then 'nao_gerado' when l.superseded_by is not null then 'substituido' when l.valid_until is not null and l.valid_until<current_date then 'expirado' when a.decision='accepted' then 'aceito' when a.decision='accepted_with_notes' then 'aceito_com_ressalvas' when a.decision='rejected' then 'recusado' when l.acceptance_required and l.client_released_at is not null then 'aguardando_aceite' when l.client_released_at is not null then 'liberado_cliente' when l.snapshot_frozen_at is not null then 'emitido' else 'preparado' end,coalesce(l.acceptance_required,false),a.decision,l.valid_until,(l.id is not null and l.superseded_by is null and(l.valid_until is null or l.valid_until>=current_date))
 from catalog c left join latest l on l.kind_key=c.kind left join acc a on a.document_id=l.id where public.is_portal_admin() order by c.required_now desc,c.label
$$;

create or replace function public.admin_document_pending_alerts(p_project_id uuid default null)
returns table(id uuid,project_id uuid,project_name text,alert_code text,title text,message text,severity text,due_at timestamptz,is_due boolean,source_document_id uuid)
language sql stable security definer set search_path='public' as $$
 select a.id,a.project_id,p.nome,a.alert_code,a.title,a.message,a.severity,a.due_at,a.due_at<=now(),a.source_document_id from public.document_pending_alerts a join public.projetos p on p.id=a.project_id where public.is_portal_admin() and a.resolved_at is null and(p_project_id is null or a.project_id=p_project_id) order by(a.due_at<=now()) desc,a.due_at
$$;

create or replace function public.document_governance_on_document_change() returns trigger language plpgsql set search_path='public' as $$
declare k text;
begin
 k:=coalesce(nullif(new.document_kind,''),nullif(lower(new.tipo),''),'');
 if k='contrato' and new.snapshot_frozen_at is not null then insert into public.document_pending_alerts(project_id,alert_code,source_document_id,title,message,severity,due_at) values(new.projeto_id,'missing_anexo_i',new.id,'Anexo I pendente','Contrato emitido sem Anexo I correspondente.','warning',now()+interval '3 days') on conflict do nothing;
 elsif k='anexo_i' then update public.document_pending_alerts set resolved_at=now(),resolution_note='Anexo I emitido.' where project_id=new.projeto_id and alert_code='missing_anexo_i' and resolved_at is null;
 elsif k='quitacao_encerramento' then update public.document_pending_alerts set resolved_at=now(),resolution_note='Encerramento emitido.' where project_id=new.projeto_id and alert_code='missing_closure_document' and resolved_at is null; end if;
 return new;
end $$;
drop trigger if exists trg_document_governance_change on public.documentos;
create trigger trg_document_governance_change after insert or update of snapshot_frozen_at,document_kind,tipo on public.documentos for each row execute function public.document_governance_on_document_change();

create or replace function public.document_governance_on_project_change() returns trigger language plpgsql set search_path='public' as $$
begin
 if lower(coalesce(new.status,'')) in('concluido','concluído','completed','encerrado') and lower(coalesce(old.status,'')) not in('concluido','concluído','completed','encerrado') and not exists(select 1 from public.documentos d where d.projeto_id=new.id and coalesce(d.document_kind,lower(d.tipo))='quitacao_encerramento' and d.superseded_by is null) then
  insert into public.document_pending_alerts(project_id,alert_code,title,message,severity,due_at) values(new.id,'missing_closure_document','Encerramento documental pendente','Projeto concluído sem Termo de Quitação / Encerramento vigente.','warning',now()) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists trg_document_governance_project_change on public.projetos;
create trigger trg_document_governance_project_change after update of status on public.projetos for each row execute function public.document_governance_on_project_change();

alter table public.document_acceptances enable row level security;
alter table public.document_pending_alerts enable row level security;
drop policy if exists document_acceptances_client_read on public.document_acceptances;
create policy document_acceptances_client_read on public.document_acceptances for select to authenticated using(public.user_has_project_access(project_id));
drop policy if exists document_acceptances_admin_read on public.document_acceptances;
create policy document_acceptances_admin_read on public.document_acceptances for select to authenticated using(public.is_portal_admin());
drop policy if exists document_pending_alerts_admin_read on public.document_pending_alerts;
create policy document_pending_alerts_admin_read on public.document_pending_alerts for select to authenticated using(public.is_portal_admin());

grant execute on function public.client_accept_document(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.client_document_map(uuid) to authenticated;
grant execute on function public.admin_release_document_for_client(uuid,boolean,date,date) to authenticated;
grant execute on function public.admin_supersede_document(uuid,uuid,text) to authenticated;
grant execute on function public.admin_set_document_validity(uuid,date,date) to authenticated;
grant execute on function public.admin_project_document_map(uuid) to authenticated;
grant execute on function public.admin_document_pending_alerts(uuid) to authenticated;
