import fs from 'node:fs';

const loginPath = 'site-public/login.html';
const siteKey = (process.env.TURNSTILE_SITE_KEY || '').trim();

if (!siteKey) {
  console.error('ERRO: TURNSTILE_SITE_KEY ausente; o login clássico não pode ser publicado sem CAPTCHA.');
  process.exit(1);
}

if (!fs.existsSync(loginPath)) {
  console.error('ERRO: site-public/login.html não encontrado para injeção do Turnstile.');
  process.exit(1);
}

const escapeAttribute = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const html = fs.readFileSync(loginPath, 'utf8');
const marker = /(<meta\s+name=["']cme-turnstile-site-key["']\s+content=["'])[^"']*(["']\s*>)/i;

if (!marker.test(html)) {
  console.error('ERRO: marcador cme-turnstile-site-key não encontrado no login clássico.');
  process.exit(1);
}

const next = html.replace(marker, `$1${escapeAttribute(siteKey)}$2`);
fs.writeFileSync(loginPath, next);

const verified = fs.readFileSync(loginPath, 'utf8');
if (/name=["']cme-turnstile-site-key["']\s+content=["']\s*["']/i.test(verified)) {
  console.error('ERRO: Site Key do Turnstile permaneceu vazia após a injeção.');
  process.exit(1);
}

console.log('Site Key pública do Turnstile injetada no login clássico.');
