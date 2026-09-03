import fs from 'node:fs';
import path from 'node:path';

const root = 'site-public';
const robotsPath = path.join(root, 'robots.txt');
const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : '';
const disallowed = new Set(
  [...robots.matchAll(/^Disallow:\s*\/(.+\.html)\s*$/gmi)].map(match => match[1])
);

const restrictedExtras = [
  'login.html', 'recuperar-senha.html', 'redefinir-senha.html',
  'orcamentos-contratos.html', 'arquivo-documental.html', 'conteudo-site.html',
  'baixar-app.html', 'indicacoes.html'
];
restrictedExtras.forEach(file => disallowed.add(file));

const clientPwaPattern = /^(portal|meu-projeto|login|recuperar-senha|redefinir-senha|baixar-app|biblioteca-cliente|documentos-cliente|fotos-cliente|agenda-cliente|cronograma-cliente|solicitacoes-cliente)\.html$/;

function injectBefore(html, token, snippet) {
  if (html.includes(snippet.trim())) return html;
  if (!html.includes(token)) throw new Error(`Marcador ${token} ausente no HTML.`);
  return html.replace(token, `${snippet}\n${token}`);
}

for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  const file = path.join(root, name);
  let html = fs.readFileSync(file, 'utf8');

  const looksRestricted = disallowed.has(name) ||
    /js\/(?:auth|cliente-area|admin-[^"']*)\.js/i.test(html) ||
    /<body[^>]+data-area=/i.test(html) && /logoutButton|supabaseClient/i.test(html);

  if (looksRestricted && !/name=["']robots["']/i.test(html)) {
    html = injectBefore(html, '</head>', '    <meta name="robots" content="noindex,nofollow,noarchive">');
  }

  // Camada responsiva única para site público, portal administrativo e portal do cliente.
  // O versionamento definitivo é aplicado depois pelo apply-build-version.mjs.
  if (!html.includes('css/mobile-experience.css')) {
    html = injectBefore(html, '</head>', '    <link rel="stylesheet" href="css/mobile-experience.css?v=mobile">');
  }
  if (!html.includes('js/mobile-experience.js')) {
    html = injectBefore(html, '</body>', '    <script src="js/mobile-experience.js?v=mobile"></script>');
  }

  if (clientPwaPattern.test(name)) {
    if (!/rel=["']manifest["']/i.test(html)) {
      html = injectBefore(html, '</head>', '    <link rel="manifest" href="/manifest.webmanifest">');
    }
    if (!/apple-mobile-web-app-capable/i.test(html)) {
      html = injectBefore(html, '</head>', '    <meta name="apple-mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
    }
    if (!html.includes('js/pwa-client.js')) {
      html = injectBefore(html, '</body>', '    <script src="js/pwa-client.js?v=20260903-1"></script>');
    }
  }

  fs.writeFileSync(file, html);
}

console.log(`HTML publicado endurecido; ${disallowed.size} rotas restritas catalogadas e camada mobile aplicada.`);
