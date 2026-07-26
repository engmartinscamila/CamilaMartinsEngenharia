# Camila Martins Engenharia — publicação protegida V14

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

## Como publicar

Substitua o conteúdo atual do repositório do site pelo conteúdo desta pasta,
mantendo a estrutura exatamente como está. Depois aguarde o GitHub Actions
concluir e atualize o navegador com `Ctrl + F5`.

Mantenha o ZIP original em local privado. Ele é a versão editável do projeto.
Esta versão ofuscada deve ser utilizada apenas para publicação.

## Limite da proteção

Todo site público precisa entregar HTML, CSS e JavaScript ao navegador.
Ofuscação dificulta a leitura e a reutilização da lógica, mas não torna a cópia
tecnicamente impossível. Dados privados continuam protegidos pelas políticas
RLS e pelo Storage privado do Supabase.
