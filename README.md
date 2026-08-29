# Camila Martins Engenharia — site integrado 0.10.2

O site institucional continua na raiz do domínio e a nova área restrita fica em
`/portal`. O diretório publicável é gerado automaticamente em `dist`; não
publique a raiz do repositório como se ela fosse o resultado final.

As instruções exatas de Cloudflare, variáveis e Supabase estão em
`PUBLICACAO_CLOUDFLARE.md`. O histórico técnico da integração está em
`CHANGELOG_REV10_2.md`.

## Publicação anterior

Esta pasta é a versão de produção preparada exclusivamente para publicação no
GitHub Pages.

## Proteções aplicadas

- Os 22 arquivos JavaScript próprios foram minificados e ofuscados.
- Os 3 blocos JavaScript internos das páginas HTML também foram ofuscados.
- Os nomes dos arquivos e a estrutura das pastas foram preservados.
- Os marcadores de cache foram atualizados para `v=20260725-14`.
- Não foram gerados mapas de código-fonte.
- A pasta privada `supabase/`, com SQLs e Edge Functions, não faz parte desta
  versão de publicação.

## Como era publicado

O fluxo antigo enviava a raiz estática diretamente ao GitHub Pages. Na revisão
0.10.2, o GitHub Pages fica disponível somente por acionamento manual e usa o
mesmo build integrado do Cloudflare.

Mantenha o ZIP original em local privado. Ele é a versão editável do projeto.
Esta versão ofuscada deve ser utilizada apenas para publicação.

## Limite da proteção

Todo site público precisa entregar HTML, CSS e JavaScript ao navegador.
Ofuscação dificulta a leitura e a reutilização da lógica, mas não torna a cópia
tecnicamente impossível. Dados privados continuam protegidos pelas políticas
RLS e pelo Storage privado do Supabase.
