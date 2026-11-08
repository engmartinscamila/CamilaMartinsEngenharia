-- Reversão controlada somente da função de aplicação de modelos.
-- Não apaga nenhuma tarefa, cliente, projeto, contrato ou template.
-- Preserva a assinatura pública e o guard administrador existente.
CREATE OR REPLACE FUNCTION private.apply_task_template(
  p_template_id uuid,p_project_id uuid,p_start_date date
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_portal_admin() THEN RAISE EXCEPTION 'Acesso administrativo necessário'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.projetos WHERE id=p_project_id AND contract_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Projeto com contrato obrigatório não encontrado'; END IF;
  INSERT INTO public.project_tasks(project_id,title,description,priority,start_date,due_date,weight,client_visible,position)
  SELECT p_project_id,i.title,i.description,i.priority,
    p_start_date+i.offset_days,p_start_date+i.offset_days+i.duration_days-1,
    i.weight,i.client_visible,i.position
  FROM public.task_template_items i JOIN public.task_templates t
    ON t.id=i.template_id AND t.active
  WHERE i.template_id=p_template_id ORDER BY i.position;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$function$;
