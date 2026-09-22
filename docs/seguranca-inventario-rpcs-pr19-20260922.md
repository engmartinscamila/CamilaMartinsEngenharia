# Auditoria defensiva — inventário de 39 RPCs privilegiadas (22/09/2026)

**Escopo:** leitura de metadados de `pg_proc`, `pg_namespace`, ACLs e Supabase Security Advisor do projeto de produção `portal-cliente`; análise de código, privilégios e riscos **sem executar nenhuma RPC com identidade de cliente**, sem consultar registros pessoais e sem alterar banco/Storage. Evidência inicial: Advisor 0029 = 39 ocorrências; proteção de senhas vazadas = desativada. Nenhum alerta isolado prova exploração. O vídeo mencionado no relatório de transferência é educativo, não um teste deste site.

## Constatações comprovadas somente por metadados

- As **39 funções** examinadas pertencem ao owner `postgres`, executam como `SECURITY DEFINER`, estão no esquema exposto `public`, são executáveis por `authenticated` e **não** são executáveis por `anon` no momento da leitura. Como o owner é privilegiado, devem ser tratadas como interfaces de autorização sensíveis mesmo com RLS nas tabelas.
- Todas apresentam configuração explícita de `search_path`, mas parte usa `public` ou `public, vault` em vez do caminho vazio; confirmar qualificação de identificadores e dependências **individualmente** antes de alterar. Ocorrência textual de `is_portal_admin()` ou `auth.uid()` não comprova que a condição seja obrigatória, que a operação esteja restrita ao recurso certo nem que caminhos de exceção estejam seguros.
- Não foi feito login com cliente A/B nem pentest. Não há base para afirmar vazamento, comprometimento ou autorização correta das 39 funções.

Referências oficiais: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/api/securing-your-api .

## Triagem individual: comportamento esperado a validar em homologação

**Admin — exigir prova de administrador no servidor, negar cliente comum e validar objeto/argumentos (23 funções):**

1. `admin_apply_task_template` — modelo e projeto autorizados.
2. `admin_archive_client_financial_history` — cliente certo, confirmação e histórico.
3. `admin_create_prospect_access_link` — registro comercial e expiração restritos.
4. `admin_document_pending_alerts` — limitar leitura ao escopo administrativo.
5. `admin_mark_exported_documents_purged` — lote válido, operação autorizada e sem perda inadvertida.
6. `admin_prepare_contract_document` — projeto/tipo/aprovação coerentes.
7. `admin_prepare_formal_notice` — aprovação e versão corretas.
8. `admin_preview_contract_document` — prévia limitada ao contrato e escopo.
9. `admin_professional_identity_status` — dados de identidade somente a administradora.
10. `admin_publish_contract_master` — versão, revisão e aprovação humana obrigatórias.
11. `admin_purge_client_database` — fluxo destrutivo exclusivamente administrativo; **não executar** para testar.
12. `admin_release_document_for_client` — documento pertencente ao projeto correto.
13. `admin_reply_request` — solicitação e cliente vinculados.
14. `admin_reset_financial_data` — operação destrutiva exclusivamente administrativa; **não executar** para testar.
15. `admin_run_operational_reminders` — frequência e destinatários controlados.
16. `admin_save_professional_identity` — nunca permitir edição por cliente.
17. `admin_set_document_validity` — documento certo e datas válidas.
18. `admin_supersede_document` — origem/destino do mesmo escopo e histórico preservado.
19. `admin_update_request_status` — solicitação correta.
20. `admin_upsert_document_text` — catálogo e versão governados.
21. `admin_upsert_service_catalog` — catálogo não alterado por usuário comum.
22. `admin_upsert_service_level` — níveis vinculados ao contrato vigente.
23. `consume_admin_rate_limit` — comprovar proteção da operação administrativa e evitar abuso do contador.

**Acesso/identidade (5 funções):**

24. `can_access_contract` — negar outro contrato e não retornar conteúdo confidencial.
25. `can_access_project` — negar projeto de cliente B; administrador autorizado.
26. `current_client_id` — retornar somente identidade ligada à própria sessão.
27. `is_portal_admin` — apuração de privilégio independente de metadados editáveis pelo cliente.
28. `user_has_project_access` — verificar associação atual e negativa cruzada.

**Aceites e interações de cliente (6 funções):**

29. `accept_current_legal_documents` — aceitar somente em nome da própria sessão.
30. `client_accept_document` — documento próprio, decisão/versão coerentes.
31. `mark_own_notification_read` — apenas notificação destinada ao usuário.
32. `mark_received_notification_read` — remetente/destinatário e papel coerentes.
33. `reply_to_own_request` — apenas solicitação própria.
34. `respond_to_own_agenda` — apenas compromisso do próprio usuário.

**Outras interações por usuário (5 funções):**

35. `desativar_push_token` — somente token associado à própria sessão.
36. `register_own_push_token` — associação ao próprio usuário e limites.
37. `registrar_push_diagnostico` — nenhum `p_cliente_id` arbitrário, logs minimizados.
38. `registrar_push_token` — vínculo ao usuário correto, nunca token de outro cliente.
39. `respond_to_own_approval` — aprovação de documento destinado ao usuário; sem alteração de dados alheios.

> Esta classificação é uma **hipótese de uso a conferir**, não a demonstração dos predicados implementados nem um atestado de que algum item esteja vulnerável. Para cada função, registrar assinatura, proprietário, grants herdados/PUBLIC, chamadas reais web/app, corpo e fluxo de autorização, objeto/tenant, limites de entrada, teste A/B/admin, correção proposta e regressão. Não revogar EXECUTE em massa, não trocar `SECURITY DEFINER` indiscriminadamente e não testar RPC destrutiva na produção.

## Demais gates de segurança ainda abertos

- Auditar bundle publicado e variáveis sem copiar segredos para relatórios; scanner de histórico isolado não comprova ausência no bundle de produção.
- Conferir configurações reais de Cloudflare (WAF/rate limit/CAPTCHA) e Supabase Auth; ativação de controle pago ou que altere a UX requer aceite e verificação de plano/custo.
- Verificar todas as políticas por objeto, Storage, views e Edge Functions; entradas no servidor, saídas HTML/CSP, SQL dinâmico parametrizado, URLs HTTP externas/SSRF somente onde existirem, integrações LLM somente onde realmente usadas, limites e mensagens de erro.
- Homologar com usuários e dados fictícios, reunir evidências PASS/FAIL por função/fluxo; qualquer desvio comprovado bloqueia deploy até correção e regressão.
- Proteção de senhas vazadas está desativada na produção no momento da leitura. A documentação Supabase informa disponibilidade no plano Pro ou superior: https://supabase.com/docs/guides/auth/password-security . Confirmar plano atual e autorização de impacto/custo antes de ativar.

**Status global:** inventário e critérios documentados; revisão semântica individual, testes autenticados, correções de funções e configuração de segurança **não concluídos**. Produção permaneceu inalterada.
