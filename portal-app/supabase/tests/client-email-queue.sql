-- Run through the administrative SQL connection. All fixtures are rolled back;
-- the asynchronous dispatcher cannot see them or send test mail.
begin;
do $$
declare c uuid; p uuid; j uuid; lease uuid; n bigint; after_count bigint;
begin
  insert into public.clientes(nome,email,status)
  values('[TESTE] Fila transacional','delivered+'||gen_random_uuid()::text||'@resend.dev','ativo') returning id into c;
  if (select count(*) from public.client_email_queue where client_id=c and kind='invite')<>1 then raise exception 'Convite automático ausente'; end if;
  select count(*) into n from public.client_email_queue where client_id=c;
  update public.clientes set nome=nome,auth_id=auth_id where id=c;
  if (select count(*) from public.client_email_queue where client_id=c)<>n then raise exception 'No-op gerou e-mail'; end if;
  update public.clientes set telefone='11900000001' where id=c;
  if (select count(*) from public.client_email_queue where client_id=c and kind='update')<>1 then raise exception 'Atualização de perfil sem e-mail'; end if;
  insert into public.projetos(cliente_id,nome) values(c,'[TESTE] Projeto da fila') returning id into p;
  if (select count(*) from public.client_email_queue where client_id=c and project_id=p and source_table='projetos')<>1
    or exists(select 1 from public.client_email_queue where client_id=c and project_id=p and source_table='project_portal_settings') then raise exception 'Criação de projeto duplicou o aviso'; end if;
  select count(*) into n from public.client_email_queue where client_id=c;
  insert into public.documentos(cliente_id,projeto_id,nome,arquivo,workflow_status,generated_at,client_visible,exibir_cliente)
  values(c,p,'[TESTE] Rascunho privado','teste-sem-arquivo','rascunho',now(),false,false);
  select count(*) into after_count from public.client_email_queue where client_id=c;
  if n<>after_count then raise exception 'Rascunho privado gerou e-mail'; end if;
  update public.project_portal_settings set show_photos=false where project_id=p;
  select count(*) into n from public.client_email_queue where client_id=c;
  insert into public.fotos(cliente_id,projeto_id,nome,arquivo) values(c,p,'[TESTE] Foto oculta','teste-sem-arquivo');
  if (select count(*) from public.client_email_queue where client_id=c)<>n then raise exception 'Módulo oculto gerou e-mail'; end if;
  insert into public.client_email_queue(client_id,kind,source_table,payload,available_at)
  values(c,'update','teste',jsonb_build_object('token_hash','token-simulado','prepared_email','{}'::jsonb),now()+interval '1 day') returning id into j;
  select lease_token into lease from public.claim_client_email_jobs(1,j);
  if (select count(*) from public.claim_client_email_jobs(1,j))<>0 then raise exception 'Dois processadores adquiriram o mesmo envio'; end if;
  perform public.finish_client_email_job(j,lease,null,'TESTE: provedor indisponível');
  if not exists(select 1 from public.client_email_queue where id=j and status='pending' and available_at>now() and lease_token is null) then raise exception 'Nova tentativa perdida'; end if;
  select lease_token into lease from public.claim_client_email_jobs(1,j);
  perform public.finish_client_email_job(j,lease,'provider-test',null);
  if not exists(select 1 from public.client_email_queue where id=j and status='sent' and not payload ? 'token_hash' and not payload ? 'prepared_email') then raise exception 'Token preservado após envio'; end if;
  if has_table_privilege('anon','public.client_email_queue','SELECT')
    or has_table_privilege('authenticated','public.client_email_queue','SELECT')
    or has_function_privilege('authenticated','public.enqueue_client_invitation(uuid)','EXECUTE')
    or has_function_privilege('anon','public.claim_client_email_jobs(integer,uuid)','EXECUTE') then raise exception 'Fila exposta ao portal'; end if;
  begin
    insert into public.clientes(nome,email) values('[TESTE] E-mail inválido','invalido');
    raise exception 'Cadastro inválido aceito';
  exception when raise_exception then if sqlerrm not like 'Informe um e-mail válido%' then raise; end if;
  end;
end $$;
rollback;
select 'PASS: convite obrigatório, perfil automático, privacidade, lease, retry, limpeza de token e isolamento da fila.' as result;
