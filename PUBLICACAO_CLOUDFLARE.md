# Publicação manual no Cloudflare Pages — revisão 0.10.2

## Resultado preparado

O pacote gera uma única publicação:

- o site institucional permanece na raiz do domínio;
- a área de clientes e administradores fica em `/portal`;
- links públicos de **Área do Cliente** já apontam para `/portal/login`;
- URLs antigas continuam funcionando por páginas de compatibilidade;
- somente os arquivos públicos necessários e o export do portal entram em
  `dist`;
- arquivos `.env`, dependências locais, código de build e credenciais
  administrativas são bloqueados pelo verificador.

## Configuração exata do projeto Cloudflare Pages

Conecte o repositório que receberá manualmente este pacote e use:

| Campo do Cloudflare | Valor |
|---|---|
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | deixar vazio |
| Build command | `npm run build:cloudflare` |
| Build output directory | `dist` |
| Build system | `v3` |
| Node.js | `22.16.0`, lido de `.node-version` |

Não use `/portal`, `portal-app/dist` ou a raiz do repositório como diretório de
saída. O caminho correto é somente `dist`.

Não foi incluído `wrangler.toml`: em um projeto Pages conectado ao Git, ele não
é necessário para este build e poderia substituir configurações já existentes
no painel. Também não há regra SPA `/* /index.html 200`, porque o Expo gerou uma
página HTML estática para cada rota.

## Variáveis de produção no Cloudflare

Em **Settings > Environment variables**, ambiente **Production**, cadastre:

```text
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF=REFERENCIA_REAL_DO_PROJETO_DE_PRODUCAO
EXPO_PUBLIC_SUPABASE_URL=https://REFERENCIA_REAL_DO_PROJETO_DE_PRODUCAO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=CHAVE_SB_PUBLISHABLE_DE_PRODUCAO
```

Use o mesmo projeto Supabase já utilizado pelo site. A chave precisa ser a
Publishable (`sb_publishable_...`) ou a chave pública `anon` legada. Nunca use
Secret key nem `service_role`. As variáveis `EXPO_PUBLIC_*` aparecem no bundle
por definição e, portanto, só podem conter valores públicos.

O build é interrompido se o ambiente não for `production`, se a URL não
corresponder à referência esperada, se faltar rota obrigatória, se um arquivo
exceder 25 MiB ou se for detectada credencial administrativa.

## Domínio e caminhos

No Cloudflare Pages, adicione o domínio principal:

```text
camilamartinsengenharia.com.br
```

Se `www.camilamartinsengenharia.com.br` também for usado, adicione-o ao mesmo
projeto e configure um redirecionamento único para o domínio principal. O
arquivo `CNAME` foi preservado para compatibilidade, mas a associação do domínio
Cloudflare é feita no painel.

Rotas finais importantes:

| Área | URL |
|---|---|
| Site público | `https://camilamartinsengenharia.com.br/` |
| Login | `https://camilamartinsengenharia.com.br/portal/login` |
| Cliente | `https://camilamartinsengenharia.com.br/portal/home` |
| Admin | `https://camilamartinsengenharia.com.br/portal/admin` |
| Recuperar senha | `https://camilamartinsengenharia.com.br/portal/forgot-password` |
| Redefinir senha | `https://camilamartinsengenharia.com.br/portal/reset-password` |

## Supabase Auth e Edge Functions

Em **Authentication > URL Configuration**:

- defina a Site URL como `https://camilamartinsengenharia.com.br/portal`;
- permita `https://camilamartinsengenharia.com.br/portal/reset-password`;
- mantenha `camilamartinsengenharia://reset-password` para Android/iOS;
- para preview, permita apenas a URL exata que será testada e remova-a depois.

Nos segredos das Edge Functions de produção, use:

```text
APP_REDIRECT_URL=https://camilamartinsengenharia.com.br/portal/reset-password
ALLOWED_ORIGIN=https://camilamartinsengenharia.com.br
```

As funções `admin-invite-client`, `admin-delete-client`,
`issue-protected-asset` e `send-push-notifications` devem permanecer publicadas
com validação de JWT e os segredos internos do Supabase configurados somente no
servidor.

## Ordem segura para atualização manual

1. Faça backup do repositório atual.
2. Extraia o ZIP e envie o conteúdo da pasta principal ao repositório; não envie
   o ZIP dentro do repositório.
3. Configure os campos e as quatro variáveis do Cloudflare antes do primeiro
   deploy.
4. Confirme no log as mensagens `APROVADO` do portal e do site integrado.
5. Abra primeiro a URL temporária `pages.dev` e valide site, imagens, vídeos,
   galeria e cartão virtual.
6. Configure no Supabase as URLs e os segredos acima.
7. Teste login e redefinição de senha; em seguida teste uma conta admin e duas
   contas clientes de projetos diferentes.
8. Só associe o domínio de produção depois da aprovação desses testes.

O workflow antigo do GitHub Pages foi mantido somente para acionamento manual,
evitando uma segunda publicação automática concorrente com o Cloudflare.
Se esse fallback for acionado, cadastre nele os três secrets públicos do
Supabase com os mesmos nomes usados no workflow.

## Validações que dependem do ambiente real

O código e o export foram verificados localmente, mas um ZIP não comprova o
estado do banco remoto. Antes da produção ainda é obrigatório confirmar:

- migrações aditivas aplicadas após backup;
- RLS e Storage impedindo acesso cruzado entre Cliente A e Cliente B;
- administradora reconhecida pelo registro protegido no banco;
- Edge Functions publicadas e com JWT/segredos corretos;
- e-mails de convite e recuperação chegando com a URL de `/portal`;
- domínio, TLS e redirecionamento entre `www` e domínio principal.

Use os roteiros existentes em `portal-app/docs/FASE_6_HOMOLOGACAO.md` e
`portal-app/docs/FASE_7_HOMOLOGACAO.md`; eles já reúnem os testes externos e não
precisam ser refeitos na análise do código.
