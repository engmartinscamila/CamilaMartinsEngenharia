#!/usr/bin/env bash
set -euo pipefail

rm -rf site-public
mkdir -p site-public

find . -maxdepth 1 -type f -name '*.html' -exec cp {} site-public/ \;
cp -R assets site-public/assets
cp -R css site-public/css
cp -R js site-public/js
touch site-public/.nojekyll
printf '%s\n' "${GITHUB_SHA:-local-build}" > site-public/build-version.txt

for file in CNAME robots.txt sitemap.xml manifest.webmanifest camila-martins.vcf firebase-messaging-sw.js; do
  if [[ -f "$file" ]]; then
    cp "$file" site-public/
  fi
done

# Garante que todas as páginas administrativas recebam imediatamente o menu e a proteção
# das novas áreas, sem depender do cache de versões antigas de ui-core/auth.
while IFS= read -r -d '' html; do
  sed -E -i 's#js/ui-core\.js\?v=[0-9-]+#js/ui-core.js?v=20260901-2#g; s#js/auth\.js\?v=[0-9-]+#js/auth.js?v=20260901-2#g' "$html"
done < <(find site-public -maxdepth 1 -type f -name '*.html' -print0)

# Endurecimento é feito apenas no artefato publicado: mantém o código-fonte legível,
# mas garante que o portal clássico use a mesma camada protegida do aplicativo.
node scripts/harden-client-area.mjs
node scripts/harden-public-html.mjs

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

echo "JavaScript publicado minificado e com identificadores locais abreviados."
