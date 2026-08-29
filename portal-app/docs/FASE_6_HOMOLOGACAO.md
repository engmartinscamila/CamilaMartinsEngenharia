# Fase 6 — ligar e testar o aplicativo na homologação

Este procedimento usa exclusivamente o projeto Supabase
`camila-martins-homologacao` (`nvhjcoxnzigwwbdbhkhq`). O aplicativo bloqueará
qualquer URL de outro projeto. Não aplique nada no projeto principal.

## 1. Copiar somente a chave pública

No painel do projeto de homologação:

1. Clique no botão verde **Connect**.
2. Abra a área de chaves da API.
3. Copie a chave identificada como **Publishable key** (`sb_publishable_...`).
4. Não copie nem mostre `Secret key` ou `service_role`.

A Publishable key é feita para o aplicativo cliente. As chaves secretas ficam
somente no servidor e o código do app bloqueia seu uso por engano.

## 2. Criar a configuração local

Na pasta do aplicativo, execute:

```bash
npm ci
cp .env.homologation.example .env.local
```

Abra `.env.local` e substitua somente:

```text
COLE_A_CHAVE_PUBLISHABLE_DO_PROJETO_DE_HOMOLOGACAO
```

pela Publishable key copiada no passo 1. Não envie esse arquivo pelo chat.

Confirme que o bloqueio está correto:

```bash
npm run check:homologation
```

Resultado obrigatório:

```text
APROVADO: aplicativo travado na homologação (nvhjcoxnzigwwbdbhkhq).
```

## 3. Autorizar o link de criação e recuperação de senha

No painel do projeto de homologação:

1. Abra **Authentication > URL Configuration**.
2. Em **Redirect URLs**, adicione
   `camilamartinsengenharia://reset-password`.
3. Salve.

## 4. Publicar as duas Edge Functions pelo painel

Use os arquivos da pasta `supabase/dashboard-deploy/`. Eles são autossuficientes
e não contêm nenhuma chave.

### Função de convite

1. Abra **Edge Functions**.
2. Clique em **Deploy a new function** e depois **Via Editor**.
3. Nome: `admin-invite-client`.
4. Apague o exemplo do editor.
5. Cole todo o conteúdo de
   `supabase/dashboard-deploy/admin-invite-client.ts`.
6. Clique em **Deploy function**.

### Função de exclusão protegida

Repita os passos anteriores com:

- nome: `admin-delete-client`;
- arquivo: `supabase/dashboard-deploy/admin-delete-client.ts`.

### Único segredo adicional

Em **Edge Functions > Secrets**, adicione:

```text
APP_REDIRECT_URL=camilamartinsengenharia://reset-password
```

Não crie manualmente `SUPABASE_URL`, `SUPABASE_ANON_KEY` ou
`SUPABASE_SERVICE_ROLE_KEY`: o Supabase já fornece essas variáveis às funções.

## 5. Abrir o aplicativo

No computador:

```bash
npm start
```

O terminal mostrará um QR Code. No Android, abra pelo Expo Go. No iPhone, leia o
QR Code pela câmera e abra no Expo Go. Computador e celular devem estar na mesma
rede, salvo se o terminal oferecer conexão por túnel.

O login deve mostrar o aviso **Ambiente de homologação**.

## 6. Teste visual obrigatório

Use somente as três contas fictícias criadas na Fase 5. As senhas ficam apenas
com a proprietária.

1. Entre como Cliente A e confira Início, Projeto, Documentos, Fotos, Biblioteca,
   Agenda, Cronograma, Solicitações e Aprovações.
2. Saia e entre como Cliente B. Nenhum contrato, projeto ou dado do Cliente A
   pode aparecer.
3. Saia e entre como Administradora. Confirme o acesso ao painel administrativo
   e aos dados dos dois clientes fictícios.
4. Se algum cliente enxergar dados do outro, pare o teste e não avance.

## 7. Teste A/B automatizado

Copie o exemplo local:

```bash
cp env.ab.example .env.ab.local
```

Preencha a mesma Publishable key e as três senhas de teste somente no arquivo
`.env.ab.local`. Depois execute:

```bash
npm run test:rls-ab
```

Resultado obrigatório:

```text
APROVADO: isolamento Administrador / Cliente A / Cliente B validado.
```

O script cria e remove uma solicitação temporária. Não execute com contas reais.

## 8. Testar convite e exclusão sem prejudicar o teste A/B

Somente depois dos passos anteriores:

1. Como administradora, convide uma quarta conta fictícia e descartável.
2. Confirme o recebimento do convite e a criação da senha.
3. Use essa quarta conta para testar a exclusão completa.
4. Não exclua Cliente A ou Cliente B antes de concluir todos os testes.

## Resultado desta fase

A Fase 6 estará concluída quando as duas funções estiverem publicadas, os três
logins funcionarem, o teste visual não revelar acesso cruzado e o comando
`npm run test:rls-ab` retornar `APROVADO`. Isso valida homologação; ainda não é
autorização para alterar produção ou publicar nas lojas.
