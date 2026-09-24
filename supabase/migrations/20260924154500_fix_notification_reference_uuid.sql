-- Corrige a tipagem de notificacoes.referencia_id (uuid) nos fluxos de
-- liberação e aceite documental. A versão anterior convertia UUID para text,
-- causando falha transacional tanto no release quanto no aceite do cliente.

create or replace function public.client_accept_document(
  p_document_id uuid,
  p_decision text,
  p_note text default null,
  p_source text default 'portal',
  p_client_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d public.documentos%rowtype;
  v_client uuid;
  v_hash text;
  v_id uuid;
  v_version text;
begin
  if auth.uid() is null then raise exception 'Sessão do cliente necessária.'; end if;
  if p_decision not in('accepted','accepted_with_notes','rejected') then raise exception 'Manifestação inválida.'; end if;
  if p_decision in('accepted_with_notes','rejected') and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Informe a observação desta manifestação.';
  end if;

  select * into d from public.documentos where id=p_document_id;
  if d.id is null then raise exception 'Documento não encontrado.'; end if;
  if public.is_portal_admin() or not public.user_has_project_access(d.projeto_id) then
    raise exception 'Aceite permitido somente ao cliente vinculado.';
  end if;
  if not(coalesce(d.client_visible,false) or coalesce(d.exibir_cliente,false)) or d.client_released_at is null then
    raise exception 'Documento ainda não foi liberado ao cliente.';
  end if;
  if not coalesce(d.acceptance_required,false) then raise exception 'Este documento não requer aceite.'; end if;
  if d.snapshot_frozen_at is null then raise exception 'Documento ainda não está congelado para aceite.'; end if;
  if d.superseded_by is not null then raise exception 'Esta versão foi substituída.'; end if;
  if d.valid_until is not null and d.valid_until<current_date then raise exception 'Documento expirado.'; end if;

  v_version:=coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0');
  select cliente_id into v_client from public.projetos where id=d.projeto_id;
  select snapshot_hash into v_hash
  from public.document_emission_snapshots
  where document_id=d.id
  order by emitted_at desc
  limit 1;

  if nullif(v_hash,'') is null then
    v_hash:=encode(digest(convert_to(coalesce(d.generated_data,'{}'::jsonb)::text||'|'||d.id::text||'|'||v_version,'UTF8'),'sha256'),'hex');
  end if;

  insert into public.document_acceptances(
    document_id,project_id,client_id,user_id,document_version,snapshot_hash,
    decision,note,source,client_context
  )
  values(
    d.id,d.projeto_id,v_client,auth.uid(),v_version,v_hash,
    p_decision,nullif(btrim(coalesce(p_note,'')),''),
    case when p_source in('web','app','portal') then p_source else 'portal' end,
    coalesce(p_client_context,'{}'::jsonb)
  )
  returning id into v_id;

  update public.document_pending_alerts
  set resolved_at=now(),resolution_note='Manifestação do cliente registrada.'
  where source_document_id=d.id
    and alert_code='awaiting_document_acceptance'
    and resolved_at is null;

  insert into public.notificacoes(
    cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,
    referencia_tipo,referencia_id
  )
  values(
    v_client,d.projeto_id,'Manifestação documental do cliente',
    'Manifestação registrada para '||coalesce(d.nome,'Documento')||' — versão '||v_version||'.',
    'document_acceptance',false,'orcamentos-contratos.html','admin',
    'document_acceptance',v_id
  );

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),'client_document_acceptance','documentos',d.id,
    jsonb_build_object(
      'acceptance_id',v_id,'decision',p_decision,'version',v_version,
      'snapshot_hash',v_hash,'source',p_source
    )
  );

  return v_id;
exception when unique_violation then
  raise exception 'Você já registrou uma manifestação para esta versão.';
end
$function$;

create or replace function public.admin_release_document_for_client(
  p_document_id uuid,
  p_acceptance_required boolean default true,
  p_valid_from date default null,
  p_valid_until date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d public.documentos%rowtype;
  v_client uuid;
  v_version text;
begin
  if not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.'; end if;

  select * into d from public.documentos where id=p_document_id;
  if d.id is null then raise exception 'Documento não encontrado.'; end if;
  if d.snapshot_frozen_at is null then raise exception 'Emita/congele o documento antes de liberá-lo.'; end if;
  if d.superseded_by is not null then raise exception 'Versão substituída não pode ser liberada.'; end if;
  if p_valid_until is not null and p_valid_from is not null and p_valid_until<p_valid_from then
    raise exception 'Período de validade inválido.';
  end if;

  v_version:=coalesce(nullif(d.version,''),to_jsonb(d)->>'versao','1.0');

  update public.documentos
  set client_visible=true,
      exibir_cliente=true,
      acceptance_required=coalesce(p_acceptance_required,true),
      client_released_at=now(),
      client_released_by=auth.uid(),
      valid_from=coalesce(p_valid_from,current_date),
      valid_until=p_valid_until
  where id=p_document_id;

  select cliente_id into v_client from public.projetos where id=d.projeto_id;

  if p_acceptance_required then
    insert into public.document_pending_alerts(
      project_id,alert_code,source_document_id,title,message,severity,due_at
    )
    values(
      d.projeto_id,'awaiting_document_acceptance',d.id,'Aceite documental pendente',
      coalesce(d.nome,'Documento')||' — versão '||v_version||' aguarda manifestação do cliente.',
      'warning',now()+interval '5 days'
    )
    on conflict do nothing;
  end if;

  if p_valid_until is not null then
    insert into public.document_pending_alerts(
      project_id,alert_code,source_document_id,title,message,severity,due_at
    )
    values(
      d.projeto_id,'document_expiring',d.id,'Validade documental',
      coalesce(d.nome,'Documento')||' — versão '||v_version||' precisa de revisão de validade.',
      'warning',p_valid_until::timestamptz
    )
    on conflict do nothing;
  end if;

  insert into public.notificacoes(
    cliente_id,projeto_id,titulo,mensagem,tipo,lida,link_path,destinatario,
    referencia_tipo,referencia_id
  )
  values(
    v_client,d.projeto_id,
    case when p_acceptance_required then 'Documento disponível para aceite' else 'Novo documento disponível' end,
    coalesce(d.nome,'Documento')||' — versão '||v_version||' está disponível no portal.',
    'document_release',false,
    'documentos-cliente.html?projeto='||d.projeto_id::text,
    'cliente','documento',d.id
  );
end
$function$;

revoke all on function public.client_accept_document(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.client_accept_document(uuid,text,text,text,jsonb) to authenticated,service_role;

revoke all on function public.admin_release_document_for_client(uuid,boolean,date,date) from public,anon;
grant execute on function public.admin_release_document_for_client(uuid,boolean,date,date) to authenticated,service_role;
