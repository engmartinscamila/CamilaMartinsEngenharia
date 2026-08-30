# Worker de mídia pública — Camila Martins Engenharia

Este Worker é o ponto único de acesso ao bucket R2 da galeria pública.

## Nomes esperados

- Worker: `cme-public-media`
- Binding R2: `MEDIA_BUCKET`
- Bucket sugerido: `camila-martins-public-media`
- Domínio: `midia.camilamartinsengenharia.com.br`

## Variáveis obrigatórias

Variáveis comuns:

- `SUPABASE_URL`
- `ALLOWED_ORIGINS`
- `MAX_UPLOAD_BYTES`

Segredos / variáveis sensíveis:

- `SUPABASE_ANON_KEY`
- `ADMIN_UID`

O Worker valida o JWT do Supabase no próprio Supabase Auth e compara o ID do usuário com `ADMIN_UID`.

## Rotas

- `GET /health`
- `GET /api/manifest`
- `PUT /api/manifest` — requer admin
- `PUT /api/upload?key=portfolio/...` — requer admin
- `DELETE /api/object?key=portfolio/...` — requer admin
- `GET /media/portfolio/...` — público

A exclusão só retorna sucesso depois de verificar que o objeto não existe mais no R2.
