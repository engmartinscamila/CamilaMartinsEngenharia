-- Anexo I passa a ser exigido somente quando houver serviço adicional.
-- Regra: todo o escopo, valores e condições contratados ficam no contrato principal.
-- O Anexo I só é obrigatório quando o contrato (ou um projeto vinculado a ele) tem
-- documento de Serviço Adicional não recusado pelo cliente, ou aditivo aceito.
--  * Mapa documental do projeto: "Anexo I" só aparece como "necessário agora" nesse caso.
--  * Conferência de fechamento (admin_commercial_closure): nova chave annexRequired.
--    annexCurrent mantém o significado anterior (Anexo I emitido para a versão atual).
-- As funções existentes são corrigidas por substituição pontual do texto (o resto do
-- corpo não muda); a migração falha se o trecho esperado não for encontrado.
-- Migração idempotente.

create or replace function private.annex_required_for_contract(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case when p_contract_id is null then false else (
    exists (
      select 1 from public.documentos d
      where d.document_kind = 'servico_adicional'
        and d.superseded_by is null
        and (d.contract_id = p_contract_id
             or d.projeto_id in (select p.id from public.projetos p where p.contract_id = p_contract_id))
        and coalesce((select a.decision from public.document_acceptances a
                      where a.document_id = d.id order by a.accepted_at desc limit 1), '') <> 'rejected')
    or exists (select 1 from public.contract_addenda x where x.contract_id = p_contract_id and x.status = 'accepted')
  ) end
$function$;

create or replace function private.annex_required_for_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    private.annex_required_for_contract((select p.contract_id from public.projetos p where p.id = p_project_id)), false)
  or exists (
      select 1 from public.documentos d
      where d.document_kind = 'servico_adicional' and d.superseded_by is null and d.projeto_id = p_project_id
        and coalesce((select a.decision from public.document_acceptances a
                      where a.document_id = d.id order by a.accepted_at desc limit 1), '') <> 'rejected')
$function$;

revoke all on function private.annex_required_for_contract(uuid) from public, anon;
revoke all on function private.annex_required_for_project(uuid) from public, anon;
grant execute on function private.annex_required_for_contract(uuid) to authenticated;
grant execute on function private.annex_required_for_project(uuid) to authenticated;

do $$
declare v_def text; v_new text;
begin
  -- 1) Mapa documental
  v_def := pg_get_functiondef('public.admin_project_document_map(uuid)'::regprocedure);
  if position('private.annex_required_for_project' in v_def) = 0 then
    v_new := replace(v_def, $q$('anexo_i','Anexo I',true)$q$,
                     $q$('anexo_i','Anexo I',coalesce(private.annex_required_for_project(p_project_id),false))$q$);
    if v_new = v_def then raise exception 'admin_project_document_map: trecho do Anexo I não encontrado.'; end if;
    execute v_new;
  end if;

  -- 2) Conferência de fechamento
  v_def := pg_get_functiondef('public.admin_commercial_closure(uuid)'::regprocedure);
  if position('annexRequired' in v_def) = 0 then
    v_new := replace(v_def, $q$'accessReady',coalesce(access_ready,false),$q$,
                     $q$'accessReady',coalesce(access_ready,false),'annexRequired',coalesce(private.annex_required_for_contract(r.linked_contract_id),false),$q$);
    if v_new = v_def then raise exception 'admin_commercial_closure: trecho accessReady não encontrado.'; end if;
    execute v_new;
  end if;
end $$;

-- ROLLBACK (manual): substituir de volta o 3º campo do Anexo I por true no mapa
-- documental e remover a chave annexRequired da conferência de fechamento.
