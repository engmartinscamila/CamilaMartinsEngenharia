-- A19 — A exportação administrativa (admin_export_application_backup) deixava
-- de fora dados de negócio: financial_origin_review_events (classificação
-- auditável dos lançamentos) e contract_addenda (aditivos aceitos, A18).
-- Esta migração acrescenta essas tabelas à lista "included" da própria função,
-- preservando todo o restante do corpo. Idempotente: só acrescenta o que falta.
do $migration$
declare
  v_def text := pg_get_functiondef('public.admin_export_application_backup'::regproc);
  v_add text := '';
  v_table text;
begin
  foreach v_table in array array['financial_origin_review_events','contract_addenda','project_tasks','project_task_dependencies'] loop
    if to_regclass('public.' || v_table) is not null and position('''' || v_table || '''' in v_def) = 0 then
      v_add := v_add || ',''' || v_table || '''';
    end if;
  end loop;
  if v_add = '' then return; end if;
  -- Insere logo após o primeiro item da lista "included constant text[] := array[".
  v_def := regexp_replace(v_def, '(included\s+constant\s+text\[\]\s*:=\s*array\[\s*''[a-z_]+'')', '\1' || v_add);
  if position(substr(v_add, 2) in v_def) = 0 then
    raise exception 'Não foi possível localizar a lista de tabelas do backup; nada foi alterado.';
  end if;
  execute v_def;
end
$migration$;
