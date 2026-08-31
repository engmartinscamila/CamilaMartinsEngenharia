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

for file in CNAME robots.txt sitemap.xml camila-martins.vcf firebase-messaging-sw.js; do
  if [[ -f "$file" ]]; then
    cp "$file" site-public/
  fi
done

test -f site-public/firebase-messaging-sw.js
test -f site-public/js/firebase-push-config.js
test -f site-public/js/push-cliente.js

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
