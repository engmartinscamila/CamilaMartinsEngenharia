import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../cloudflare/media-worker/src/index.js', import.meta.url), 'utf8');
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const { default: worker, manifestReferencedKeys } = await import(moduleUrl);

const evilPreflight = await worker.fetch(new Request('https://media.invalid/api/upload', {
  method: 'OPTIONS',
  headers: { Origin: 'https://evil.example' }
}), {});
assert.equal(evilPreflight.status, 403, 'Preflight de origem não autorizada deve ser bloqueado');
assert.equal(evilPreflight.headers.get('access-control-allow-origin'), null, 'CORS não pode refletir/liberar origem indevida');

const goodPreflight = await worker.fetch(new Request('https://media.invalid/api/upload', {
  method: 'OPTIONS',
  headers: { Origin: 'https://camilamartinsengenharia.com.br' }
}), {});
assert.equal(goodPreflight.status, 204, 'Preflight legítimo deve continuar funcionando');
assert.equal(goodPreflight.headers.get('access-control-allow-origin'), 'https://camilamartinsengenharia.com.br');

const badOriginWrite = await worker.fetch(new Request('https://media.invalid/api/manifest', {
  method: 'PUT',
  headers: { Origin: 'https://evil.example', Authorization: 'Bearer synthetic' },
  body: '{}'
}), {});
assert.equal(badOriginWrite.status, 403, 'Operação mutável deve validar origem antes da autenticação');

const internalFailure = await worker.fetch(new Request('https://media.invalid/api/manifest', {
  method: 'PUT',
  headers: { Origin: 'https://camilamartinsengenharia.com.br', Authorization: 'Bearer synthetic' },
  body: '{}'
}), {});
assert.equal(internalFailure.status, 500, 'Configuração ausente deve permanecer falha de servidor');
const body = await internalFailure.json();
assert.equal(body.error, 'Erro interno.', 'Falhas 5xx não podem vazar detalhes internos');

assert.match(source, /segment === "\." \|\| segment === "\.\."/,
  'Chaves de mídia precisam rejeitar segmentos de travessia');
assert.match(source, /status >= 500[\s\S]*"Erro interno\."/,
  'Falhas internas precisam de resposta pública genérica');

console.log('PASS: Worker bloqueia origem indevida, preserva CORS legítimo, sanitiza 5xx e rejeita travessia de chave.');

// Exclusão nunca remove arquivo ainda referenciado pelo catálogo novo.
const refs = manifestReferencedKeys({ projetos: [{ imagens: ['portfolio/a/imagem/01.webp', { src: 'https://cme-public-media.example.workers.dev/media/portfolio/a/video/v.mp4?x=1' }] }, { capa: '/portfolio/b/imagem/01.webp' }] });
assert.deepEqual([...refs].sort(), ['portfolio/a/imagem/01.webp', 'portfolio/a/video/v.mp4', 'portfolio/b/imagem/01.webp']);
assert.match(source, /stillReferenced\.has\(key\)[\s\S]*Nada foi removido/, 'delete-batch deve recusar arquivos ainda referenciados');
console.log('PASS: exclusão de mídia recusa arquivos ainda usados no catálogo.');
