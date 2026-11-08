# A13 — Homologação × Produção (mapa objeto a objeto, esquema `public`)

Coleta: 08/11/2026, a partir dos catálogos de `portal-cliente` (produção) e `camila-martins-homologacao`.

## Tabelas

| Só na produção | Classificação |
|---|---|
| `payment_receipts` | **Faltando na homologação.** Recibos legados são o fluxo produtivo. |
| `client_email_queue` | Faltando: fila de e-mails do portal |
| `commercial_document_jobs` | Faltando: geração assíncrona de documentos comerciais |
| `push_dispositivos`, `push_diagnosticos` | Faltando: push do site clássico |
| `google_calendar_oauth_states` | Faltando: integração de agenda (a homologação tem a variante antiga `google_calendar_tokens`) |
| `client_retention_event_archive`, `clientes_camila` | Legado e arquivo da produção. Não replicar dados. |
| `contract_addenda` | Nova (A18). Ainda pendente de aplicação na produção. |

| Só na homologação | Classificação |
|---|---|
| `fin_v2_receivables`, `fin_v2_installments`, `fin_v2_payments`, `fin_v2_allocations`, `fin_v2_receipt_records`, `fin_v2_reversals` | **Diferença intencional**: o Financeiro V2 ainda não foi promovido. Não levar para a produção sem o processo da seção 8 do plano e sem o ensaio de backup (A19). |
| `extrato_financeiro` | Parte do V2 (intencional) |
| `google_calendar_tokens` | Variante antiga, substituída na produção |

## Funções

**Só na produção (faltam na homologação):**
- **recibos:** `admin_issue_payment_receipt`, `admin_issue_receipt_for_payment`, `admin_reverse_receipted_payment`
- **e-mail:** `claim_client_email_jobs`, `finish_client_email_job`, `enqueue_client_invitation`, `prepare_client_update_email`, `admin_client_email_history`, `admin_client_email_status`
- **comercial:** `admin_commercial_closure`, `admin_resolve_commercial_closure`, `admin_project_contract_closure`, `admin_formalize_service_contract`, `admin_link_existing_project_contract`, `admin_register_existing_project_contract`, `admin_save_commercial_terms`, `admin_reclassify_commercial_service`, `assert_commercial_party_ready`, `assert_commercial_terms_ready`, `service_*commercial*` (jobs e emissões)
- **projetos e tarefas:** `admin_create_project_draft`, `admin_create_project_task`
- **operação:** `admin_reset_financial_data`, `admin_export_application_backup`, `admin_mark_exported_documents_purged`, `reconcile_imported_ofx`, `rls_auto_enable`, `service_internal_secret_get`, `touch_protected_site_pdf`, `is_pdf_admin`, `listar_armazenamento_portal`, `uso_armazenamento_portal`
- **push e agenda:** `desativar_push_token`, `registrar_push_token`, `registrar_push_diagnostico`, `google_calendar_secret_get`, `google_calendar_secret_set`

**Só na homologação:**
- `admin_fin_v2_*` (4) e `archive_json_*`: V2, **intencional**
- `admin_create_contract_project`: substituída por `admin_create_contract_project_v2`, que existe nos dois ambientes
- `is_admin`, `update_updated_at`, `portal_audit_change`, `prevent_financial_archive_mutation`, `enforce_project_contract_client`, `can_read_portal_object`, `can_read_storage_object`, `app_foundation_status`, `app_security_status`: auxiliares antigos ou de diagnóstico. Antes de remover qualquer um, conferir se algum teste de homologação ainda o usa. **Não remover agora.**

## Plano para tornar a homologação equivalente nos 6 fluxos

1. Aplicar na homologação as migrações de `supabase/migrations` que criam os objetos "só na produção" listados acima, na ordem dos nomes de arquivo. Elas são aditivas e o V2 permanece intacto.
2. Usar apenas usuários e dados sintéticos. Nunca copiar dados reais.
3. Rodar os testes E2E dos 6 fluxos contra a homologação.
4. Repetir esta comparação de catálogo depois de cada lote de migrações.

> Para executar o passo 1 é preciso autorizar a aplicação de migrações no projeto de homologação. A operação é aditiva e não toca a produção.
