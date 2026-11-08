-- Atualização da função aplicada em homologação e produção em 08/11/2026.
-- Homologada com dados sintéticos em transações ROLLBACK, sem alterar registros reais.
-- Reversão isolada disponível em docs/project-task/rollback-template-pre-contract.sql.
-- Conserva a assinatura existente, a autorização admin e a inserção transacional.
-- Mudança específica: projeto com cliente e SEM contrato pode receber modelo de tarefas.
BEGIN;

CREATE OR REPLACE FUNCTION private.apply_task_template(
  p_template_id uuid,
  p_project_id uuid,
  p_start_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_portal_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo necessário';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.projetos
    WHERE id = p_project_id AND cliente_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Projeto vinculado a cliente não encontrado';
  END IF;
  INSERT INTO public.project_tasks (
    project_id, title, description, priority, start_date, due_date,
    weight, client_visible, position
  )
  SELECT p_project_id, i.title, i.description, i.priority,
    p_start_date + i.offset_days,
    p_start_date + i.offset_days + i.duration_days - 1,
    i.weight, i.client_visible, i.position
  FROM public.task_template_items i
  JOIN public.task_templates t ON t.id = i.template_id AND t.active
  WHERE i.template_id = p_template_id
  ORDER BY i.position;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

COMMIT;

-- Pós-aplicação em homologação:
-- 1) administrador pode aplicar modelo num projeto com cliente e contract_id NULL;
-- 2) usuário cliente não pode chamar a função, inclusive com ID manipulado;
-- 3) projeto inexistente/sem cliente falha, sem registros de tarefa;
-- 4) modelo inativo não cria tarefas;
-- 5) verificar avanço, templates ativos e rollback da interface antes de produção.
