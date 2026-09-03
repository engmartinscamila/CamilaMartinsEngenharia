import fs from 'node:fs';
import path from 'node:path';

const root = 'site-public';
const errors = [];
const must = condition => (message) => { if (!condition) errors.push(message); };

must(fs.existsSync(root))('site-public não foi gerado.');
must(fs.existsSync(path.join(root, 'manifest.webmanifest')))('Manifesto PWA ausente no pacote publicado.');
must(fs.existsSync(path.join(root, 'firebase-messaging-sw.js')))('Service worker ausente no pacote publicado.');
must(fs.existsSync(path.join(root, 'js/pwa-client.js')))('Registro PWA ausente no pacote publicado.');

if (fs.existsSync(path.join(root, 'manifest.webmanifest'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  must(manifest.start_url === '/portal.html')('Manifesto PWA não inicia no portal do cliente.');
  must(manifest.display === 'standalone')('Manifesto PWA não está configurado como standalone.');
}

const forbiddenExtensions = new Set(['.zip', '.bak', '.env', '.sql', '.rte']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
      errors.push(`Artefato indevido no pacote público: ${full}`);
    }
  }
}
if (fs.existsSync(root)) walk(root);

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const restrictedPages = [...robots.matchAll(/^Disallow:\s*\/(.+\.html)\s*$/gmi)].map(match => match[1]);
for (const page of restrictedPages) {
  must(!sitemap.includes(`/${page}`))(`Rota restrita indevidamente presente no sitemap: ${page}`);
  const file = path.join(root, page);
  if (fs.existsSync(file)) {
    const html = fs.readFileSync(file, 'utf8');
    must(/name=["']robots["'][^>]+noindex|content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots/i.test(html))(`Página restrita sem noindex: ${page}`);
  }
}

for (const page of ['portal.html', 'documentos-cliente.html', 'biblioteca-cliente.html', 'fotos-cliente.html']) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  must(html.includes('/manifest.webmanifest'))(`Manifesto PWA não vinculado em ${page}.`);
  must(html.includes('js/pwa-client.js'))(`Registro PWA não vinculado em ${page}.`);
}

const clientAreaPath = path.join(root, 'js/cliente-area.js');
if (fs.existsSync(clientAreaPath)) {
  const clientArea = fs.readFileSync(clientAreaPath, 'utf8');
  must(!clientArea.includes('client-reply-form'))('Portal publicado ainda contém formulário de resposta do cliente.');
  must(!clientArea.includes('salvarRespostaCliente'))('Portal publicado ainda contém rotina de resposta direta do cliente.');
  must(clientArea.includes('issue-protected-asset'))('Documentos/fotos do portal clássico não passam pela emissão protegida.');
}

if (errors.length) {
  console.error('\nFalhas na auditoria do pacote público:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Auditoria do pacote público concluída sem falhas críticas/importantes.');
