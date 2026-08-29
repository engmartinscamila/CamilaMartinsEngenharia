# Teste A/B da segurança — Fase 4

Use somente uma branch do Supabase ou um projeto restaurado de backup. Não use clientes reais nem o banco principal neste teste.

## Preparação

1. Aplique as duas migrações na ordem descrita em `supabase/README.md`.
2. Execute `supabase/tests/phase4_security_preflight.sql`; todas as linhas devem retornar `PASS`.
3. Publique as duas Edge Functions.
4. Crie três contas de teste: Administrador, Cliente A e Cliente B.
5. Crie pelo menos um contrato e um projeto diferente para cada cliente.
6. Adicione um documento ao projeto do Cliente B para validar o bloqueio de Storage.

## Teste automatizado

Na pasta do projeto:

```bash
cp env.ab.example .env.ab.local
npm ci
npm run test:rls-ab
```

Preencha `.env.ab.local` com a URL, chave pública e credenciais das três contas de teste. O arquivo é ignorado pelo Git e não deve ser enviado a ninguém.

Resultado obrigatório:

```text
APROVADO: isolamento Administrador / Cliente A / Cliente B validado.
```

O teste confirma que cada cliente visualiza somente o próprio cadastro e projetos, bloqueia leitura cruzada nas tabelas operacionais, cria uma solicitação temporária do Cliente A, impede o Cliente B de lê-la, confirma a visão do administrador e tenta bloquear a URL assinada do documento do Cliente B para o Cliente A. A solicitação temporária é removida ao final.

## Teste visual no app

1. Cliente A: entrar, trocar entre seus projetos, abrir documentos, agenda, cronograma, aprovações e solicitações.
2. Cliente B: confirmar que nenhum dado do Cliente A aparece.
3. Administrador: criar e atualizar um projeto, enviar um arquivo, criar agenda/etapa/aprovação e responder a uma solicitação.
4. Revogar o Cliente A e confirmar que novo login/acesso aos dados deixa de funcionar.
5. Reativar o Cliente A, confirmar o acesso e somente então testar a exclusão integral com uma conta descartável.
6. Conferir em Segurança e auditoria se as ações administrativas foram registradas.

Se qualquer acesso cruzado ocorrer, pare. Não leve a migração ao banco principal e preserve a branch para diagnóstico.
