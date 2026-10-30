#!/usr/bin/env bash
set -euo pipefail

rm -rf site-public
mkdir -p site-public

BUILD_VERSION="${GITHUB_SHA:-local-$(date +%Y%m%d%H%M%S)}"

find . -maxdepth 1 -type f -name '*.html' -exec cp {} site-public/ \;
cp -R assets site-public/assets
# Originals and permanent copies must never be in the static publication.
# Portfolio/experiences are issued from the existing private Supabase bucket.
rm -rf site-public/assets/pdfs-protegidos
cp -R css site-public/css
cp -R js site-public/js

# Expor SOMENTE a prévia técnica da Casa Urben para revisão no navegador.
# Não inserir no portfólio, nem copiar todas as outras prévias do repositório.
mkdir -p site-public/previews
cp previews/casa-urben-v13-1-glb-corrigido.html site-public/previews/
cp previews/casa-urben-sketchup-original.html site-public/previews/
cp -R previews/casa-urben-v13-1-assets site-public/previews/
cp -R previews/casa-urben-v15-assets site-public/previews/
# Unlisted V14 3D review; keep the public portfolio unchanged.
cp previews/casa-urben-v14-modelo-3d.html site-public/previews/
cp -R previews/casa-urben-v14-assets site-public/previews/
test -f site-public/previews/casa-urben-v14-assets/part-16.txt
# Link acessível para aprovação, mas não indexável por mecanismos de busca.
sed -i 's/<head>/<head><meta name="robots" content="noindex,nofollow,noarchive">/' site-public/previews/casa-urben-v13-1-glb-corrigido.html
test -f site-public/previews/casa-urben-v13-1-assets/part-17.txt

# Reconstruir o GLB aprovado e corrigir os materiais após copiar para site-public.
# A geometria da Vitalle e todos os demais arquivos ficam preservados.
python3 scripts/portfolio_repair_v2.py site-public
touch site-public/.nojekyll
printf '%s\n' "$BUILD_VERSION" > site-public/build-version.txt

# Injeta a Site Key pública do Cloudflare Turnstile no login clássico.
# O segredo nunca é enviado ao frontend.
node scripts/inject-turnstile-site-key.mjs

for file in CNAME robots.txt sitemap.xml manifest.webmanifest camila-martins.vcf firebase-messaging-sw.js _headers; do
  if [[ -f "$file" ]]; then
    cp "$file" site-public/
  fi
done

# Endurecimento é feito apenas no artefato publicado: mantém o código-fonte legível,
# mas garante que o portal clássico use a mesma camada protegida do aplicativo.
node scripts/harden-client-area.mjs
node scripts/harden-public-html.mjs

# A navegação canônica já está no fonte; não reescrever URLs após os testes.
# O deploy publica <rota>/index.html para atender essas URLs sem fallback.

# Todas as referências locais JS/CSS recebem o identificador exato do build.
# Assim uma nova publicação não depende de cache-busting manual em cada HTML.
node scripts/apply-build-version.mjs "$BUILD_VERSION"

test -f site-public/firebase-messaging-sw.js
test -f site-public/manifest.webmanifest
test -f site-public/js/firebase-push-config.js
test -f site-public/js/push-cliente.js
test -f site-public/js/pwa-client.js

echo "Minificando JavaScript publicado..."
while IFS= read -r -d '' file; do
  tmp="${file}.min.tmp"
  npx --yes terser@5.44.0 "$file" \
    --compress passes=2 \
    --mangle \
    --format comments=false \
    -o "$tmp"
  mv "$tmp" "$file"
  node --check "$file" >/dev/null
done < <(find site-public/js -type f -name '*.js' -print0)

if [[ -f site-public/firebase-messaging-sw.js ]]; then
  tmp="site-public/firebase-messaging-sw.js.min.tmp"
  npx --yes terser@5.44.0 site-public/firebase-messaging-sw.js \
    --compress passes=2 \
    --mangle \
    --format comments=false \
    -o "$tmp"
  mv "$tmp" site-public/firebase-messaging-sw.js
  node --check site-public/firebase-messaging-sw.js >/dev/null
fi

echo "JavaScript publicado minificado, versionado pelo build e com identificadores locais abreviados."