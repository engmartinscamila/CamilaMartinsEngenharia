# Publicação pelo painel do Supabase

Use estes três arquivos somente no projeto `camila-martins-homologacao`.
Cada arquivo já contém todas as dependências necessárias para ser colado no
editor online do Supabase, sem Supabase CLI.

1. Abra **Edge Functions** no projeto de homologação.
2. Selecione **Deploy a new function** e depois **Via Editor**.
3. Crie `admin-invite-client`, substitua o exemplo pelo conteúdo de
   `admin-invite-client.ts` e publique.
4. Repita para `admin-delete-client` usando `admin-delete-client.ts`.
5. Crie `issue-protected-asset` usando `issue-protected-asset.ts`.
6. Mantenha **Verify JWT** ativado nas três funções.
7. Em **Edge Functions > Secrets**, adicione somente:
   `APP_REDIRECT_URL=camilamartinsengenharia://reset-password`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são
fornecidas automaticamente às funções pelo Supabase. Não copie nem compartilhe
a `service_role`.
