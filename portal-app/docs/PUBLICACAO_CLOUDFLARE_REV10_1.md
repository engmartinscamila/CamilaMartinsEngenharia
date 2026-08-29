# Publicação web integrada — revisão 10.2

O site público e este portal agora fazem parte do mesmo pacote. O site público
permanece na raiz do domínio e o export estático do Expo é publicado em
`/portal`.

Configuração final:

- site público: `https://camilamartinsengenharia.com.br/`;
- login: `https://camilamartinsengenharia.com.br/portal/login`;
- cliente autenticado: `https://camilamartinsengenharia.com.br/portal/home`;
- administração: `https://camilamartinsengenharia.com.br/portal/admin`;
- redefinição: `https://camilamartinsengenharia.com.br/portal/reset-password`.

O `experiments.baseUrl` do Expo foi definido como `/portal`, por isso rotas,
fontes e bundles usam o mesmo caminho. O build da raiz monta o site completo no
diretório `dist` e cria páginas de compatibilidade para os endereços antigos.
Não adicione redirecionamento SPA global.

Use no Cloudflare Pages:

| Campo | Valor |
|---|---|
| Framework preset | `None` |
| Production branch | `main` |
| Root directory | vazio |
| Build command | `npm run build:cloudflare` |
| Build output directory | `dist` |
| Node.js | `22.16.0` pela `.node-version` |

As variáveis, URLs permitidas e etapas finais estão no arquivo
`PUBLICACAO_CLOUDFLARE.md`, na raiz do pacote.
