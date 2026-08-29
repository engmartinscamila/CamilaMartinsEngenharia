# Fase 7 — finanças, proteção autoral, segurança e identidade

Execute tudo somente em `camila-martins-homologacao`
(`nvhjcoxnzigwwbdbhkhq`). Não aplique no banco principal.

## Ordem segura

1. Pare o aplicativo local com `Ctrl+C`.
2. No Supabase de homologação, abra **SQL Editor > New query**.
3. Cole todo o arquivo
   `supabase/migrations/20260812030000_financial_retention_theme_storage.sql`.
4. Clique em **Run** uma única vez e aguarde `Success`.
5. Em nova consulta, cole `supabase/tests/phase7_security_preflight.sql`.
6. Execute e só prossiga se o resultado contiver `"status":"APROVADO"`.

## Publicar as três funções

Em **Edge Functions > Deploy a new function > Via Editor**, crie:

| Nome exato | Arquivo para colar |
|---|---|
| `admin-invite-client` | `supabase/dashboard-deploy/admin-invite-client.ts` |
| `admin-delete-client` | `supabase/dashboard-deploy/admin-delete-client.ts` |
| `issue-protected-asset` | `supabase/dashboard-deploy/issue-protected-asset.ts` |

Mantenha **Verify JWT** ativado nas três. Não cole nenhuma chave no código.

Em **Edge Functions > Secrets**, mantenha apenas o segredo adicional:

```text
APP_REDIRECT_URL=camilamartinsengenharia://reset-password
```

O Supabase fornece as demais variáveis automaticamente. Nunca copie a
`service_role` para o aplicativo ou para uma conversa.

## Iniciar o aplicativo

```powershell
npm.cmd run check:homologation
npm.cmd start
```

## Testes manuais obrigatórios

### Administrador

1. Confirme que o cabeçalho é horizontal e a logo não domina a tela.
2. Alterne entre **Escuro**, **Claro** e **Automático**.
3. Clique em **Sincronizar** e confirme a mensagem de sucesso.
4. Abra **Contratos e projetos** e crie um contrato fictício com valor.
5. Abra **Extrato financeiro (somente admin)**, registre uma entrada e uma saída.
6. Em **Central de arquivos**, envie:
   - um PDF administrativo, como orçamento fictício;
   - um PDF técnico autoral;
   - uma foto autoral.
7. Abra **Segurança e Storage** e confira os detalhes dos órfãos sem excluir nada.

### Cliente A

1. Confirme que não existe menu de extrato financeiro.
2. O documento administrativo deve abrir com acesso temporário e download
   autorizado.
3. O PDF autoral deve abrir como cópia identificada.
4. A foto autoral deve abrir com marca d'água.
5. Nenhum dado ou arquivo do Cliente B pode aparecer.
6. Em **Perfil e segurança**, clique em **Sincronizar**.

### Espelhamento Portal ↔ aplicativo

1. Mantenha o aplicativo aberto com um cliente fictício.
2. No Portal administrativo conectado ao mesmo Supabase de homologação, publique
   uma notificação ou altere uma etapa desse cliente.
3. Confirme que a tela aberta é atualizada sem encerrar a sessão.
4. Faça uma solicitação no aplicativo e confirme que ela aparece no Portal admin.
5. Repita com Cliente B e confirme que Cliente A não recebe o evento nem os dados.

O Realtime apenas avisa que houve mudança. A nova leitura passa novamente pelas
RLS. Extratos e tabelas financeiras não entram no canal Realtime.

### Exclusão descartável

Use somente uma quarta conta fictícia. Na prévia, confira valores e arquivos;
digite o nome completo; execute a exclusão. Depois, em **Extrato financeiro**,
confirme que o histórico preservado ainda identifica cliente, contrato e valores.

## Teste A/B automatizado

Preencha localmente `env.ab.example` como `.env.ab.local` com três contas de
teste e execute:

```powershell
npm.cmd run test:rls-ab
```

O teste exige:

- Cliente A e Cliente B isolados;
- nenhum cliente lendo `financeiro`, `extrato_financeiro` ou o arquivo histórico;
- administrador lendo a área financeira;
- Cliente A incapaz de emitir arquivo do Cliente B.

Resultado obrigatório:

```text
APROVADO: isolamento Administrador / Cliente A / Cliente B validado.
```

## Limites honestos

- captura de tela não pode ser bloqueada de forma confiável em todos os aparelhos;
- a marca d'água identifica e desestimula uso indevido, mas não torna extração
  tecnicamente impossível;
- publicação nas lojas exige contas Apple/Google e revisão externa;
- produção só deve receber a migração depois de homologação, backup e aprovação.
- o site/portal publicado só será um espelho se estiver configurado com o mesmo
  projeto Supabase e com as migrações desta versão; um site estático separado não
  se sincroniza sozinho.
