# Edge Functions administrativas

Estas funções usam a sessão real do administrador para autorizar a ação e a
`SUPABASE_SERVICE_ROLE_KEY` somente no servidor. Essa chave nunca entra no app.

Publicação, depois de validar as migrações em uma branch/backup:

```bash
supabase functions deploy admin-invite-client
supabase functions deploy admin-delete-client
supabase functions deploy issue-protected-asset
supabase secrets set APP_REDIRECT_URL="camilamartinsengenharia://reset-password"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas
automaticamente pelo ambiente das Edge Functions. Opcionalmente defina
`ALLOWED_ORIGIN` para restringir a versão web a um domínio específico.

`issue-protected-asset` valida a sessão e o projeto antes de emitir qualquer
URL. Documentos técnicos recebem identificação por cliente/contrato; fotos
autorais recebem uma derivação com marca d'água. O original permanece privado.

Para publicar sem instalar a Supabase CLI, use os arquivos autossuficientes de
`supabase/dashboard-deploy/` e siga o README dessa pasta. Não tente colar somente
os arquivos desta pasta no editor web, pois eles dependem de `_shared/`.
