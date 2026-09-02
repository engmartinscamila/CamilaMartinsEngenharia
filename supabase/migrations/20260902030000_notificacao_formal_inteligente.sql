
create or replace function public.admin_prepare_formal_notice(p_approval_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_approval record;
  v_document_id uuid;
  v_commercial record;
begin
  if not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select
    a.*,
    p.contract_id,
    p.nome as project_name,
    p.tipo as project_type,
    p.area_construida_m2,
    p.area_terreno_m2,
    p.endereco_obra,
    p.numero_obra,
    p.complemento_obra,
    p.bairro_obra,
    p.cidade_obra,
    p.estado_obra,
    c.contract_number,
    c.signed_at as contract_signed_at,
    cl.nome as client_name
  into v_approval
  from public.aprovacoes a
  join public.projetos p on p.id=a.projeto_id
  join public.contratos c on c.id=p.contract_id
  left join public.clientes cl on cl.id=a.cliente_id
  where a.id=p_approval_id;

  if not found then
    raise exception 'Aprovação não encontrada';
  end if;

  if v_approval.status<>'aguardando' then
    raise exception 'A aprovação já possui manifestação';
  end if;

  if v_approval.formal_notice_document_id is not null then
    return v_approval.formal_notice_document_id;
  end if;

  select cr.quote_number,cr.experience_level
  into v_commercial
  from public.commercial_records cr
  where cr.linked_contract_id=v_approval.contract_id
     or cr.linked_project_id=v_approval.projeto_id
  order by cr.updated_at desc
  limit 1;

  insert into public.documentos(
    cliente_id,projeto_id,contract_id,approval_id,nome,tipo,categoria,versao,
    storage_bucket,permitir_download,protection_mode,document_kind,workflow_status,
    generated_data,optional_document
  )
  values(
    v_approval.cliente_id,
    v_approval.projeto_id,
    v_approval.contract_id,
    v_approval.id,
    'Notificação Formal — '||v_approval.titulo,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Contratual',
    '1.0',
    'documentos',
    true,
    'administrative',
    'notificacao_formal',
    'rascunho',
    jsonb_build_object(
      'contract_number',v_approval.contract_number,
      'contract_signed_at',v_approval.contract_signed_at,
      'client_name',v_approval.client_name,
      'project_name',v_approval.project_name,
      'project_type',v_approval.project_type,
      'area_construida_m2',v_approval.area_construida_m2,
      'area_terreno_m2',v_approval.area_terreno_m2,
      'approval_title',v_approval.titulo,
      'approval_type',v_approval.tipo,
      'approval_description',v_approval.descricao,
      'delivered_at',v_approval.delivered_at,
      'approval_due_at',v_approval.approval_due_at,
      'notification_reason','Ausência de manifestação sobre etapa entregue, dentro do prazo contratual de 10 dias corridos.',
      'regularization_days',3,
      'source_quote_number',v_commercial.quote_number,
      'experience_level',v_commercial.experience_level,
      'property_address',concat_ws(', ',
        nullif(v_approval.endereco_obra,''),
        nullif(v_approval.numero_obra,''),
        nullif(v_approval.complemento_obra,''),
        nullif(v_approval.bairro_obra,''),
        nullif(v_approval.cidade_obra,''),
        nullif(v_approval.estado_obra,'')
      )
    ),
    true
  )
  returning id into v_document_id;

  update public.aprovacoes
  set formal_notice_document_id=v_document_id
  where id=p_approval_id;

  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'prepare_formal_notice',
    'aprovacoes',
    p_approval_id,
    jsonb_build_object(
      'document_id',v_document_id,
      'contract_clause_reference','6.3',
      'courtesy_regularization_days',3
    )
  );

  return v_document_id;
end
$function$;
