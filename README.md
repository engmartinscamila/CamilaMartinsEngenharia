# Camila Martins Engenharia

Arquitetura oficial do projeto restaurada.

## Publicação do site

- O site institucional, o login, o painel administrativo e o portal do cliente são publicados como site estático pelo **GitHub Pages**.
- A autenticação, banco de dados, clientes, projetos, documentos, biblioteca, financeiro e arquivos privados continuam no **Supabase**.
- O **Cloudflare R2/Worker** é usado somente para as imagens e vídeos da galeria pública de projetos/empreendimentos.
- O código-fonte de `portal-app/` não é publicado. Seu build web integra o artefato do GitHub Pages em `/portal/`, com as centrais administrativas e o acesso do cliente.
- As páginas HTML antigas continuam como ferramentas e rotas de compatibilidade; compartilham o mesmo Supabase com o portal.
- O workflow `.github/workflows/pages.yml` prepara o site, valida regressões, exporta o portal integrado e publica o pacote final.
- A auditoria de cobertura e o plano de ação estão em `docs/auditoria-sistema-20261105.md`.

## Regra de arquitetura

Cloudflare não deve substituir o portal, o Admin, o login nem o backend Supabase. A integração Cloudflare fica restrita às mídias públicas da galeria.

## Proteções

- JavaScript de produção permanece ofuscado onde já estava.
- Dados privados permanecem protegidos por autenticação, RLS e Storage privado do Supabase.
- O repositório pode conter código de desenvolvimento que não é publicado no artefato do site.


## Estado de publicação

O projeto Cloudflare Pages foi removido. O site oficial é publicado pelo GitHub Pages; Cloudflare permanece restrito às mídias públicas por R2/Worker.
