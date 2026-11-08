// Ponte da galeria: arquivo marcado para exclusão que o catálogo salvo ainda usa nunca é apagado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const calls = [];
const window = {
  supabaseClient: {
    storage: { from: () => ({}) },
    auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } }, error: null }) }
  }
};
const context = vm.createContext({ window, console, Blob, URL, setTimeout,
  fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ ok: true }) }; } });
vm.runInContext(fs.readFileSync('js/portfolio-r2-bridge.js', 'utf8'), context);
const bucket = window.supabaseClient.storage.from('projetos');
const manifest = (imagens) => new Blob([JSON.stringify({ projetos: [{ slug: 'a', imagens }, { slug: 'b', imagens: ['portfolio/a/imagem/02.webp'] }] })], { type: 'application/json' });

// 02 é compartilhada com o projeto b; 01 saiu do catálogo.
await bucket.remove(['portfolio/a/imagem/01.webp', 'portfolio/a/imagem/02.webp']);
let result = await bucket.upload('portfolio/galeria.json', manifest(['portfolio/a/imagem/03.webp']));
assert.equal(result.error, null);
assert.ok(calls.at(-1).url.endsWith('/api/delete-batch'));
assert.deepEqual(calls.at(-1).body.keys, ['portfolio/a/imagem/01.webp'], 'Somente o arquivo fora do catálogo pode ser excluído');

// Tudo ainda referenciado: nenhuma exclusão, apenas o catálogo é salvo.
await bucket.remove(['portfolio/a/imagem/03.webp']);
result = await bucket.upload('portfolio/galeria.json', manifest(['portfolio/a/imagem/03.webp']));
assert.equal(result.error, null);
assert.ok(calls.at(-1).url.endsWith('/api/manifest'), 'Sem exclusão quando o arquivo continua no catálogo');
console.log('PASS: galeria nunca apaga mídia ainda usada no catálogo.');
