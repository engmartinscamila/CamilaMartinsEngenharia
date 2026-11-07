import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const ignored = new Set(['.git', 'node_modules', '.expo', '.next', 'dist', 'build', '.cache', 'coverage', 'artifacts']);
const textExt = new Set(['.html', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.css', '.json', '.yml', '.yaml', '.md', '.sql', '.sh', '.py', '.xml', '.webmanifest', '.txt']);
const codeExt = new Set(['.html', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.css']);
const all = [];
function walk(dir = '') {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const name = path.posix.join(dir, item.name);
    if (item.isDirectory()) {
      if (!ignored.has(item.name)) walk(name);
    } else if (item.isFile()) {
      const stat = fs.statSync(path.join(ROOT, name));
      all.push({ path: name, size: stat.size, ext: path.extname(name).toLowerCase() });
    }
  }
}
walk();

const source = new Map();
for (const file of all) {
  // Large 3D chunks / binary media are versioned assets, not source text.
  if (!textExt.has(file.ext) || file.size > 900_000 || /previews\/.*\/part-\d+\.txt$/.test(file.path)) continue;
  try { source.set(file.path, fs.readFileSync(path.join(ROOT, file.path), 'utf8')); } catch { /* unreadable -> unknown, not safe to delete */ }
}
const runtime = (name) => name.endsWith('.html') || name.startsWith('js/') || name.startsWith('css/')
  || name.startsWith('portal-app/src/') || name.startsWith('portal-app/supabase/functions/')
  || name.startsWith('supabase/functions/') || name.startsWith('.github/workflows/')
  || name === 'package.json' || name === 'portal-app/package.json';
const references = (target) => {
  const filename = path.posix.basename(target);
  return [...source.entries()].filter(([p, value]) => p !== target &&
    (value.includes(target) || value.includes(filename))).map(([p]) => p);
};

const uiFiles = all.filter(f => /^js\/[^/]+\.js$/.test(f.path) || /^css\/[^/]+\.css$/.test(f.path));
const maybeUnused = uiFiles.map(f => {
  const refs = references(f.path);
  const effective = source.get(f.path)?.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').trim() ?? null;
  return { ...f, runtimeRefs: refs.filter(runtime), testRefs: refs.filter(x => !runtime(x) && (x.startsWith('scripts/') || x.startsWith('portal-app/scripts/'))),
    docRefs: refs.filter(x => !runtime(x) && !(x.startsWith('scripts/') || x.startsWith('portal-app/scripts/'))),
    emptyCode: effective === '' };
});
const noRuntimeRef = maybeUnused.filter(f => f.runtimeRefs.length === 0);
const noOp = maybeUnused.filter(f => f.emptyCode);
const noOpUnreferenced = noOp.filter(f => f.runtimeRefs.length === 0);
const duplicates = new Map();
for (const f of all.filter(f => codeExt.has(f.ext) && f.size > 0 && f.size < 400_000)) {
  const bytes = fs.readFileSync(path.join(ROOT, f.path));
  const key = crypto.createHash('sha256').update(bytes).digest('hex');
  duplicates.set(key, [...(duplicates.get(key) ?? []), f.path]);
}
const sameContent = [...duplicates.values()].filter(names => names.length >= 2);

const previewGroups = {};
for (const f of all.filter(f => f.path.startsWith('previews/'))) {
  const match = f.path.match(/^previews\/(casa-urben-v[^/]+-assets)\//);
  if (!match) continue;
  const group = match[1];
  previewGroups[group] ??= { files: 0, bytes: 0, referencingSources: [] };
  previewGroups[group].files++;
  previewGroups[group].bytes += f.size;
}
for (const g of Object.keys(previewGroups)) previewGroups[g].referencingSources = [...source.entries()]
  .filter(([file, content]) => !file.startsWith('previews/') && content.includes(g))
  .map(([file]) => file).slice(0, 10);

const report = {
  generatedAt: new Date().toISOString(),
  files: all.length,
  bytes: all.reduce((sum, f) => sum + f.size, 0),
  checkedTextFiles: source.size,
  evaluatedLegacyJsCss: uiFiles.length,
  noOp,
  noOpUnreferenced,
  noRuntimeRef,
  sameContent,
  previewGroups,
  warnings: [
    'Referência textual ausente não prova que arquivo não é usado: acessos diretos, histórico, configuração remota, URLs antigas e imports dinâmicos podem alcançá-lo.',
    'Rotas Expo file-based, migrations Supabase, funções Edge, scripts manuais, arquivos 3D versionados e documentos históricos não devem ser excluídos apenas por esta análise.',
    'Remoção segura: somente arquivos vazios ou contendo comentários sem referência runtime, e após teste de publicação.',
  ],
};
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/code-hygiene-audit.json'), JSON.stringify(report, null, 2));
const lines = [
  '# Auditoria automatizada de código e arquivos sem função',
  '',
  'Esta análise é conservadora: relatórios de candidatos não autorizam exclusão automática.',
  '',
  `Arquivos: ${report.files}; fontes textuais inspecionadas: ${source.size}; JS/CSS legado avaliado: ${uiFiles.length}.`,
  '',
  '## Sem lógica executável e sem referência de execução',
  ...noOpUnreferenced.map(x => `- ${x.path} (${x.size} bytes)`),
  '',
  '## JS/CSS sem referências estáticas de execução (investigar, não excluir)',
  ...noRuntimeRef.map(x => `- ${x.path} (${x.size} bytes; menções em testes: ${x.testRefs.length}; menções em docs: ${x.docRefs.length})`),
  '',
  '## Conteúdo idêntico',
  ...sameContent.map(x => `- ${x.join(' | ')}`),
  '',
  '## Histórico de partes 3D (NÃO excluir por tamanho)',
  ...Object.entries(previewGroups).map(([g, v]) => `- ${g}: ${v.files} partes, ${(v.bytes/1_048_576).toFixed(2)} MiB; referências fora de previews: ${v.referencingSources.join(', ') || 'nenhuma estática'}`),
  '',
  ...report.warnings.map(x => '> ' + x),
];
fs.writeFileSync(path.join(ROOT, 'artifacts/code-hygiene-audit.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
