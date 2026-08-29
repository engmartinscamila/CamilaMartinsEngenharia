import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const portalOutput = join(root, 'portal-app', 'dist');

if (!existsSync(portalOutput)) {
  throw new Error('O export do portal não existe. Execute primeiro npm run build:portal.');
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const copyFile = (sourceRelative, targetRelative = sourceRelative) => {
  const source = join(root, sourceRelative);
  if (!existsSync(source)) {
    throw new Error(`Arquivo público obrigatório ausente: ${sourceRelative}`);
  }
  const target = join(output, targetRelative);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
};

[
  'index.html',
  'contato.html',
  'experiencias.html',
  'galeria-projetos.html',
  'portfolio.html',
  'pdf-protegido.html',
  'camila-martins.vcf',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'css/styles.css',
  'css/galeria-projetos.css',
  'css/pdf-protection.css',
  'js/script.js',
  'js/supabase.js',
  'js/galeria-projetos.js',
  'js/pdf-protection-viewer.js',
].forEach((path) => copyFile(path));

copyFile('cloudflare/_headers', '_headers');
cpSync(portalOutput, join(output, 'portal'), { recursive: true });

const legacyRoutes = new Map([
  ['login.html', '/portal/login'],
  ['redefinir-senha.html', '/portal/reset-password'],
  ['portal.html', '/portal/home'],
  ['meu-projeto.html', '/portal/project'],
  ['biblioteca-cliente.html', '/portal/library'],
  ['documentos-cliente.html', '/portal/documents'],
  ['fotos-cliente.html', '/portal/photos'],
  ['agenda-cliente.html', '/portal/agenda'],
  ['cronograma-cliente.html', '/portal/schedule'],
  ['solicitacoes-cliente.html', '/portal/requests'],
  ['admin.html', '/portal/admin'],
  ['dashboard.html', '/portal/admin'],
  ['clientes.html', '/portal/admin/clients'],
  ['projetos.html', '/portal/admin/projects'],
  ['documentos.html', '/portal/admin'],
  ['biblioteca.html', '/portal/admin/content'],
  ['protecao-pdf-admin.html', '/portal/admin/content'],
  ['fotos.html', '/portal/admin/content'],
  ['financeiro.html', '/portal/admin/financial'],
  ['agenda.html', '/portal/admin/agenda'],
  ['cronograma.html', '/portal/admin/schedule'],
  ['solicitacoes.html', '/portal/admin/requests'],
  ['configuracoes.html', '/portal/admin/security'],
]);

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

for (const [legacyFile, destination] of legacyRoutes) {
  const safeDestination = escapeHtml(destination);
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta http-equiv="refresh" content="0; url=${safeDestination}">
  <title>Redirecionando | Camila Martins Engenharia</title>
  <script>window.location.replace(${JSON.stringify(destination)} + window.location.search + window.location.hash);</script>
</head>
<body>
  <p>Redirecionando para a área segura. <a href="${safeDestination}">Continuar</a>.</p>
</body>
</html>
`;
  writeFileSync(join(output, legacyFile), html, 'utf8');
}

process.stdout.write(`Site integrado montado em ${output}.\n`);
