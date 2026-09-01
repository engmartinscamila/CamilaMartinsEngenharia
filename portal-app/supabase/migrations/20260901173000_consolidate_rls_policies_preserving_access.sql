BEGIN;

DROP POLICY IF EXISTS admin_total_seguro ON public.agenda;
DROP POLICY IF EXISTS cliente_le_propria_agenda ON public.agenda;
CREATE POLICY agenda_select_access ON public.agenda FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY agenda_admin_insert ON public.agenda FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY agenda_admin_update ON public.agenda FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY agenda_admin_delete ON public.agenda FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS aprovacoes_admin_total_app ON public.aprovacoes;
DROP POLICY IF EXISTS aprovacoes_cliente_read_app ON public.aprovacoes;
CREATE POLICY aprovacoes_select_access ON public.aprovacoes FOR SELECT TO authenticated USING (is_portal_admin() OR cliente_id = current_client_id() OR (projeto_id IS NOT NULL AND can_access_project(projeto_id)));
CREATE POLICY aprovacoes_admin_insert ON public.aprovacoes FOR INSERT TO authenticated WITH CHECK (is_portal_admin());
CREATE POLICY aprovacoes_admin_update ON public.aprovacoes FOR UPDATE TO authenticated USING (is_portal_admin()) WITH CHECK (is_portal_admin());
CREATE POLICY aprovacoes_admin_delete ON public.aprovacoes FOR DELETE TO authenticated USING (is_portal_admin());

DROP POLICY IF EXISTS admin_total_seguro ON public.biblioteca;
DROP POLICY IF EXISTS cliente_le_biblioteca_propria ON public.biblioteca;
CREATE POLICY biblioteca_select_access ON public.biblioteca FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY biblioteca_admin_insert ON public.biblioteca FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY biblioteca_admin_update ON public.biblioteca FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY biblioteca_admin_delete ON public.biblioteca FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS admin_total_seguro ON public.clientes;
DROP POLICY IF EXISTS cliente_le_proprio_cadastro ON public.clientes;
CREATE POLICY clientes_select_access ON public.clientes FOR SELECT TO authenticated USING (private.eh_administradora() OR auth_id = (SELECT auth.uid()));
CREATE POLICY clientes_admin_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY clientes_admin_update ON public.clientes FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY clientes_admin_delete ON public.clientes FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS contract_scope_admin_manage ON public.contract_scope_items;
DROP POLICY IF EXISTS contract_scope_read ON public.contract_scope_items;
CREATE POLICY contract_scope_select_access ON public.contract_scope_items FOR SELECT TO authenticated USING (is_portal_admin() OR can_access_contract(contract_id));
CREATE POLICY contract_scope_admin_insert ON public.contract_scope_items FOR INSERT TO authenticated WITH CHECK (is_portal_admin());
CREATE POLICY contract_scope_admin_update ON public.contract_scope_items FOR UPDATE TO authenticated USING (is_portal_admin()) WITH CHECK (is_portal_admin());
CREATE POLICY contract_scope_admin_delete ON public.contract_scope_items FOR DELETE TO authenticated USING (is_portal_admin());

DROP POLICY IF EXISTS contratos_admin_total_app ON public.contratos;
DROP POLICY IF EXISTS contratos_cliente_le_app ON public.contratos;
CREATE POLICY contratos_select_access ON public.contratos FOR SELECT TO authenticated USING (is_portal_admin() OR cliente_id = current_client_id());
CREATE POLICY contratos_admin_insert ON public.contratos FOR INSERT TO authenticated WITH CHECK (is_portal_admin());
CREATE POLICY contratos_admin_update ON public.contratos FOR UPDATE TO authenticated USING (is_portal_admin()) WITH CHECK (is_portal_admin());
CREATE POLICY contratos_admin_delete ON public.contratos FOR DELETE TO authenticated USING (is_portal_admin());

DROP POLICY IF EXISTS admin_total_seguro ON public.cronograma;
DROP POLICY IF EXISTS cliente_le_proprio_cronograma ON public.cronograma;
CREATE POLICY cronograma_select_access ON public.cronograma FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY cronograma_admin_insert ON public.cronograma FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY cronograma_admin_update ON public.cronograma FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY cronograma_admin_delete ON public.cronograma FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS document_archive_batches_admin_read ON public.document_archive_batches;

DROP POLICY IF EXISTS admin_total_seguro ON public.documentos;
DROP POLICY IF EXISTS cliente_le_proprios_documentos ON public.documentos;
CREATE POLICY documentos_select_access ON public.documentos FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY documentos_admin_insert ON public.documentos FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY documentos_admin_update ON public.documentos FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY documentos_admin_delete ON public.documentos FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS admin_total_seguro ON public.fotos;
DROP POLICY IF EXISTS cliente_le_proprias_fotos ON public.fotos;
CREATE POLICY fotos_select_access ON public.fotos FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY fotos_admin_insert ON public.fotos FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY fotos_admin_update ON public.fotos FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY fotos_admin_delete ON public.fotos FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS notificacoes_admin_total_app ON public.notificacoes;
DROP POLICY IF EXISTS notificacoes_cliente_read_app ON public.notificacoes;
CREATE POLICY notificacoes_select_access ON public.notificacoes FOR SELECT TO authenticated USING (is_portal_admin() OR (destinatario = 'cliente' AND (cliente_id = current_client_id() OR (projeto_id IS NOT NULL AND can_access_project(projeto_id)))));
CREATE POLICY notificacoes_admin_insert ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (is_portal_admin());
CREATE POLICY notificacoes_admin_update ON public.notificacoes FOR UPDATE TO authenticated USING (is_portal_admin()) WITH CHECK (is_portal_admin());
CREATE POLICY notificacoes_admin_delete ON public.notificacoes FOR DELETE TO authenticated USING (is_portal_admin());

DROP POLICY IF EXISTS project_members_admin_total_app ON public.project_members;
DROP POLICY IF EXISTS project_members_self_read_app ON public.project_members;
CREATE POLICY project_members_select_access ON public.project_members FOR SELECT TO authenticated USING (is_portal_admin() OR user_id = (SELECT auth.uid()));
CREATE POLICY project_members_admin_insert ON public.project_members FOR INSERT TO authenticated WITH CHECK (is_portal_admin());
CREATE POLICY project_members_admin_update ON public.project_members FOR UPDATE TO authenticated USING (is_portal_admin()) WITH CHECK (is_portal_admin());
CREATE POLICY project_members_admin_delete ON public.project_members FOR DELETE TO authenticated USING (is_portal_admin());

DROP POLICY IF EXISTS admin_total_seguro ON public.projetos;
DROP POLICY IF EXISTS cliente_le_proprios_projetos ON public.projetos;
CREATE POLICY projetos_select_access ON public.projetos FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY projetos_admin_insert ON public.projetos FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY projetos_admin_update ON public.projetos FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY projetos_admin_delete ON public.projetos FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS admin_le_push ON public.push_dispositivos;
DROP POLICY IF EXISTS cliente_le_push_proprio ON public.push_dispositivos;
CREATE POLICY push_dispositivos_select_access ON public.push_dispositivos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pdf_admins p WHERE p.user_id = (SELECT auth.uid()))
  OR ((auth_user_id = (SELECT auth.uid())) AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = push_dispositivos.cliente_id AND c.auth_id = (SELECT auth.uid())))
);

DROP POLICY IF EXISTS admin_total_seguro ON public.solicitacao_respostas;
DROP POLICY IF EXISTS cliente_le_respostas_proprias ON public.solicitacao_respostas;
CREATE POLICY solicitacao_respostas_select_access ON public.solicitacao_respostas FOR SELECT TO authenticated USING (
  private.eh_administradora()
  OR ((cliente_id = private.cliente_atual_id()) AND EXISTS (SELECT 1 FROM public.solicitacoes solicitacao WHERE solicitacao.id = solicitacao_respostas.solicitacao_id AND solicitacao.cliente_id = private.cliente_atual_id()))
);
CREATE POLICY solicitacao_respostas_admin_insert ON public.solicitacao_respostas FOR INSERT TO authenticated WITH CHECK (private.eh_administradora());
CREATE POLICY solicitacao_respostas_admin_update ON public.solicitacao_respostas FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY solicitacao_respostas_admin_delete ON public.solicitacao_respostas FOR DELETE TO authenticated USING (private.eh_administradora());

DROP POLICY IF EXISTS admin_total_seguro ON public.solicitacoes;
DROP POLICY IF EXISTS cliente_cria_solicitacao_propria ON public.solicitacoes;
DROP POLICY IF EXISTS cliente_le_solicitacoes_proprias ON public.solicitacoes;
CREATE POLICY solicitacoes_select_access ON public.solicitacoes FOR SELECT TO authenticated USING (private.eh_administradora() OR cliente_id = private.cliente_atual_id());
CREATE POLICY solicitacoes_insert_access ON public.solicitacoes FOR INSERT TO authenticated WITH CHECK (
  private.eh_administradora()
  OR ((cliente_id = private.cliente_atual_id()) AND (projeto_id IS NULL OR EXISTS (SELECT 1 FROM public.projetos projeto WHERE projeto.id = solicitacoes.projeto_id AND projeto.cliente_id = private.cliente_atual_id())))
);
CREATE POLICY solicitacoes_admin_update ON public.solicitacoes FOR UPDATE TO authenticated USING (private.eh_administradora()) WITH CHECK (private.eh_administradora());
CREATE POLICY solicitacoes_admin_delete ON public.solicitacoes FOR DELETE TO authenticated USING (private.eh_administradora());

COMMIT;
