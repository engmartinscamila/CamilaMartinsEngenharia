# Supabase do aplicativo

Este diretório contém a fundação compatível com o Portal e a segurança final da Fase 4. Nenhuma migração deve ser aplicada no banco principal sem backup, branch de teste e aprovação do teste A/B.

## Ordem segura

1. Criar backup/checkpoint do banco principal.
2. Criar uma branch do banco ou restaurar o backup em um projeto de teste.
3. Executar `20260811220000_foundation_contracts_members.sql` somente nesse ambiente.
4. Entrar com a conta administradora e executar `select public.app_foundation_status();`.
5. Revisar `select * from public.app_migration_issues where resolved_at is null order by issue_type;`.
6. Corrigir todas as pendências de vínculo de contrato/projeto. Não continuar se houver pendência aberta.
7. Executar `20260811233000_security_admin_storage.sql`.
8. Executar `tests/phase4_security_preflight.sql` e exigir `PASS` em todas as consultas.
9. Executar `select public.app_security_status();` com a conta administradora e revisar novamente qualquer pendência criada por e-mail/Auth duplicado.
10. Publicar `admin-invite-client` e `admin-delete-client`, seguindo `functions/README.md`.
11. Criar Administrador, Cliente A e Cliente B apenas no ambiente de teste e seguir `../docs/TESTE_A_B_FASE_4.md`.
12. Só repetir as migrações no banco principal depois do backup recente e de todos os testes aprovados.

## O que as migrações não fazem automaticamente

- não executam backup;
- não corrigem silenciosamente vínculo ambíguo de dados legados;
- não publicam as Edge Functions;
- não criam contas nem senhas de teste;
- não remove as colunas antigas do Portal;
- não incluem `service_role` no aplicativo;
- não promovem a versão para produção.

A migração final neutraliza as políticas RLS/Storage legadas sem apagar objetos e cria as políticas auditadas. Ela também prepara exclusão integral de cliente, mas a exclusão só ocorre quando um administrador confirma a ação no app e a Edge Function é chamada.
