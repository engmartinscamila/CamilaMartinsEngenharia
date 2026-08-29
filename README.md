# Camila Martins Engenharia

Arquitetura oficial do projeto restaurada.

## Publicação do site

- O site institucional, o login, o painel administrativo e o portal do cliente são publicados como site estático pelo **GitHub Pages**.
- A autenticação, banco de dados, clientes, projetos, documentos, biblioteca, financeiro e arquivos privados continuam no **Supabase**.
- O **Cloudflare R2/Worker** é usado somente para as imagens e vídeos da galeria pública de projetos/empreendimentos.
- O código-fonte do aplicativo em `portal-app/` não entra no artefato público do GitHub Pages.

## Regra de arquitetura

Cloudflare não deve substituir o portal, o Admin, o login nem o backend Supabase. A integração Cloudflare fica restrita às mídias públicas da galeria.

## Proteções

- JavaScript de produção permanece ofuscado onde já estava.
- Dados privados permanecem protegidos por autenticação, RLS e Storage privado do Supabase.
- O repositório pode conter código de desenvolvimento que não é publicado no artefato do site.


## Estado de publicação

O projeto Cloudflare Pages foi removido. O site oficial é publicado pelo GitHub Pages; Cloudflare permanece restrito às mídias públicas por R2/Worker.
