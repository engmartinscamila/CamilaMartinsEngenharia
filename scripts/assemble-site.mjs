import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

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

// Publica o site/portal clássico aprovado visualmente. A revisão 0.10.2
// substituía estas páginas por redirects para o portal Expo e alterava toda
// a experiência visual. O portal Expo continua no repositório, mas não
// substitui mais o site web em produção.
for (const name of readdirSync(root)) {
  if (extname(name).toLowerCase() === '.html') copyFile(name);
}

for (const path of [
  'assets',
  'css',
  'js',
  'camila-martins.vcf',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
]) {
  copyFile(path);
}

copyFile('cloudflare/_headers', '_headers');

const redirectHtml = (destination) => `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta http-equiv="refresh" content="0; url=${destination}">
  <title>Redirecionando | Camila Martins Engenharia</title>
  <script>window.location.replace(${JSON.stringify(destination)} + window.location.search + window.location.hash);</script>
</head>
<body><p>Redirecionando… <a href="${destination}">Continuar</a>.</p></body>
</html>`;

// Compatibilidade para links/favoritos criados durante a revisão 0.10.2.
// Todos voltam para as telas clássicas, sem renderizar o layout Expo.
const compatibilityRoutes = new Map([
  ['portal/index.html', '../login.html'],
  ['portal/login.html', '../login.html'],
  ['portal/login/index.html', '../../login.html'],
  ['portal/reset-password.html', '../redefinir-senha.html'],
  ['portal/reset-password/index.html', '../../redefinir-senha.html'],
  ['portal/home.html', '../portal.html'],
  ['portal/home/index.html', '../../portal.html'],
  ['portal/project.html', '../meu-projeto.html'],
  ['portal/project/index.html', '../../meu-projeto.html'],
  ['portal/library.html', '../biblioteca-cliente.html'],
  ['portal/library/index.html', '../../biblioteca-cliente.html'],
  ['portal/documents.html', '../documentos-cliente.html'],
  ['portal/documents/index.html', '../../documentos-cliente.html'],
  ['portal/photos.html', '../fotos-cliente.html'],
  ['portal/photos/index.html', '../../fotos-cliente.html'],
  ['portal/agenda.html', '../agenda-cliente.html'],
  ['portal/agenda/index.html', '../../agenda-cliente.html'],
  ['portal/schedule.html', '../cronograma-cliente.html'],
  ['portal/schedule/index.html', '../../cronograma-cliente.html'],
  ['portal/requests.html', '../solicitacoes-cliente.html'],
  ['portal/requests/index.html', '../../solicitacoes-cliente.html'],
  ['portal/admin/index.html', '../../admin.html'],
  ['portal/admin/clients.html', '../../clientes.html'],
  ['portal/admin/projects.html', '../../projetos.html'],
  ['portal/admin/content.html', '../../biblioteca.html'],
  ['portal/admin/financial.html', '../../financeiro.html'],
  ['portal/admin/agenda.html', '../../agenda.html'],
  ['portal/admin/schedule.html', '../../cronograma.html'],
  ['portal/admin/requests.html', '../../solicitacoes.html'],
  ['portal/admin/security.html', '../../configuracoes.html'],
]);

for (const [targetRelative, destination] of compatibilityRoutes) {
  const target = join(output, targetRelative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, redirectHtml(destination), 'utf8');
}

process.stdout.write(`Site clássico integrado montado em ${output}.\n`);
