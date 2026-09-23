-- Complemento da medição auditável: não permitir que a atualização direta via REST
-- reescreva o andamento aprovado sem o evento de vistoria correspondente.
-- Não modifica linha de base, dados legados nem registros já existentes.
CREATE OR REPLACE FUNCTION public.mark_construction_measurement_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  -- O marcador pertence apenas à transação que acabou de inserir o evento.
  PERFORM pg_catalog.set_config('app.construction_measurement_event_id', NEW.id::text, true);
  RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS construction_measurement_transaction_marker ON public.construction_schedule_measurements;
CREATE TRIGGER construction_measurement_transaction_marker
 AFTER INSERT ON public.construction_schedule_measurements FOR EACH ROW
 EXECUTE FUNCTION public.mark_construction_measurement_transaction();

CREATE OR REPLACE FUNCTION public.guard_approved_schedule_actual_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
DECLARE v_state text;
DECLARE v_event text;
BEGIN
 IF NEW.actual_progress IS NOT DISTINCT FROM OLD.actual_progress
   AND NEW.actual_cost IS NOT DISTINCT FROM OLD.actual_cost
   AND NEW.actual_start IS NOT DISTINCT FROM OLD.actual_start
   AND NEW.actual_finish IS NOT DISTINCT FROM OLD.actual_finish THEN
   RETURN NEW;
 END IF;
 SELECT activation_status INTO v_state FROM public.construction_schedules WHERE id = OLD.schedule_id;
 -- Preserva a edição legítima de rascunhos e o fluxo antigo do acervo legado.
 IF v_state IS DISTINCT FROM 'approved' THEN RETURN NEW; END IF;
 v_event := pg_catalog.current_setting('app.construction_measurement_event_id', true);
 IF v_event IS NULL OR v_event !~ '^[0-9a-fA-F-]{36}$'
    OR (SELECT auth.uid()) IS NULL OR NOT public.is_portal_admin() THEN
   RAISE EXCEPTION 'Avanço do cronograma aprovado exige registro de medição datada';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.construction_schedule_measurements e
   WHERE e.id = v_event::uuid
     AND e.schedule_id = OLD.schedule_id
     AND e.item_id = OLD.id
     AND e.recorded_by = (SELECT auth.uid())
     AND e.actual_progress = NEW.actual_progress
     AND (e.actual_construction_cost IS NULL OR e.actual_construction_cost = NEW.actual_cost)
     AND (e.actual_start IS NULL OR e.actual_start = NEW.actual_start)
     AND (e.actual_finish IS NULL OR e.actual_finish = NEW.actual_finish)
 ) THEN
   RAISE EXCEPTION 'Alteração atual não corresponde à medição auditável desta atividade';
 END IF;
 RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS construction_approved_actual_write_guard ON public.construction_schedule_items;
CREATE TRIGGER construction_approved_actual_write_guard
 BEFORE UPDATE OF actual_progress,actual_cost,actual_start,actual_finish
 ON public.construction_schedule_items FOR EACH ROW
 EXECUTE FUNCTION public.guard_approved_schedule_actual_write();
REVOKE ALL ON FUNCTION public.mark_construction_measurement_transaction() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_approved_schedule_actual_write() FROM PUBLIC,anon,authenticated;
