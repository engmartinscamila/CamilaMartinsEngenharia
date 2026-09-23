-- Permite que contratos criados a partir do formulário preservem o cliente selecionado.
-- A alteração é aditiva e idempotente: documentos antigos permanecem inalterados.

do $$
declare
  f text;
begin
  select pg_get_functiondef('public.admin_create_independent_contract(jsonb,uuid[],uuid)'::regprocedure) into f;
  f := replace(
    f,
    'prospect_name,cpf_cnpj,email,phone,cep,address,city,state,',
    'linked_client_id,prospect_name,cpf_cnpj,email,phone,cep,address,city,state,'
  );
  f := replace(
    f,
    'coalesce(nullif(btrim(p_data->>''prospect_name''),''''),v_source.prospect_name,v_client.nome),',
    'nullif(p_data->>''linked_client_id'','''')::uuid,coalesce(nullif(btrim(p_data->>''prospect_name''),''''),v_source.prospect_name,v_client.nome),'
  );
  execute f;
end $$;
