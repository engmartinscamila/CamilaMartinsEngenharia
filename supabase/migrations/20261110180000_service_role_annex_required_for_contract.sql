-- A execução protegida de revisão de contrato (process-commercial-document-job) roda como
-- service_role e chama admin_commercial_closure, que usa private.annex_required_for_contract.
-- Sem esta permissão a revisão falhava com "permission denied" antes de começar.
-- (Aplicada em produção em 10/11/2026.)
grant execute on function private.annex_required_for_contract(uuid) to service_role;
