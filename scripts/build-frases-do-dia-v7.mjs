import { readFile, writeFile } from "node:fs/promises";

await import("./build-frases-do-dia-fixed.mjs");

const OUT = "assets/frases-do-dia.json";
const SEED = 20260901;

const CURADORIA = [
  { texto: "A imaginação é mais importante que o conhecimento.", autor: "Albert Einstein", categoria: "Criatividade", fonte: "What Life Means to Einstein — The Saturday Evening Post, 1929", origem: "citação" },
  { texto: "A felicidade depende de nós mesmos.", autor: "Aristóteles", categoria: "Reflexão", fonte: "Ética a Nicômaco — tradução corrente", origem: "citação" },
  { texto: "O começo é a parte mais importante do trabalho.", autor: "Platão", categoria: "Planejamento", fonte: "A República — tradução corrente", origem: "citação" },
  { texto: "Uma vida não examinada não vale a pena ser vivida.", autor: "Sócrates", categoria: "Reflexão", fonte: "Apologia de Sócrates, por Platão, 38a", origem: "citação" },
  { texto: "Sabemos o que somos, mas não o que podemos ser.", autor: "William Shakespeare", categoria: "Crescimento", fonte: "Hamlet — tradução corrente", origem: "citação" },
  { texto: "Liberdade é pouco. O que desejo ainda não tem nome.", autor: "Clarice Lispector", categoria: "Reflexão", fonte: "Perto do Coração Selvagem — citação curta", origem: "citação" },
  { texto: "Se vi mais longe, foi por estar sobre ombros de gigantes.", autor: "Isaac Newton", categoria: "Conhecimento", fonte: "Carta a Robert Hooke, 1675 — tradução corrente", origem: "citação" },
  { texto: "Na vida, nada deve ser temido, apenas compreendido.", autor: "Marie Curie", categoria: "Coragem", fonte: "Citação curta atribuída a Marie Curie", origem: "citação" }
];

function normalizar(v) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function embaralhar(itens, seed = SEED) {
  const rnd = mulberry32(seed);
  const out = [...itens];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function semAutoresConsecutivos(itens) {
  const out = embaralhar(itens);
  for (let i = 1; i < out.length; i++) {
    if (normalizar(out[i].autor) !== normalizar(out[i - 1].autor)) continue;
    let troca = i + 1;
    while (troca < out.length && normalizar(out[troca].autor) === normalizar(out[i - 1].autor)) troca++;
    if (troca >= out.length) {
      troca = 0;
      while (troca < i - 1 && (normalizar(out[troca].autor) === normalizar(out[i - 1].autor) || normalizar(out[troca + 1]?.autor) === normalizar(out[i].autor))) troca++;
    }
    if (troca < out.length && troca !== i) [out[i], out[troca]] = [out[troca], out[i]];
  }

  if (out.length > 1 && normalizar(out[0].autor) === normalizar(out.at(-1).autor)) {
    const idx = out.findIndex((item, i) => i > 1 && normalizar(item.autor) !== normalizar(out.at(-1).autor) && normalizar(out[i - 1].autor) !== normalizar(out[0].autor));
    if (idx > 0) [out[0], out[idx]] = [out[idx], out[0]];
  }

  for (let i = 1; i < out.length; i++) {
    if (normalizar(out[i].autor) === normalizar(out[i - 1].autor)) throw new Error(`Autor repetido em dias consecutivos: ${out[i].autor}`);
  }
  if (out.length > 1 && normalizar(out[0].autor) === normalizar(out.at(-1).autor)) throw new Error("Autor repetido na virada do ciclo.");
  return out;
}

const payload = JSON.parse(await readFile(OUT, "utf8"));
let frases = Array.isArray(payload.frases) ? payload.frases : [];
if (frases.length !== 1000) throw new Error(`Acervo-base inválido: ${frases.length}`);

const textosCurados = new Set(CURADORIA.map(x => normalizar(x.texto)));
const autoresCurados = new Set(CURADORIA.map(x => normalizar(x.autor)));
frases = frases.filter(x => !textosCurados.has(normalizar(x.texto)) && !autoresCurados.has(normalizar(x.autor)));

const autorais = frases.filter(x => normalizar(x.autor) === normalizar("Camila Martins"));
const externas = frases.filter(x => normalizar(x.autor) !== normalizar("Camila Martins"));
const externasNecessarias = 800 - CURADORIA.length;
const finais = [...autorais.slice(0, 200), ...CURADORIA, ...externas.slice(0, externasNecessarias)];
if (finais.length !== 1000) throw new Error(`Acervo após curadoria inválido: ${finais.length}`);

const unicos = new Set(finais.map(x => normalizar(x.texto)));
if (unicos.size !== 1000) throw new Error("Há frases duplicadas após curadoria.");

const ordenadas = semAutoresConsecutivos(finais);
const autoresObrigatorios = CURADORIA.map(x => x.autor);
for (const autor of autoresObrigatorios) {
  if (!ordenadas.some(x => normalizar(x.autor) === normalizar(autor))) throw new Error(`Autor obrigatório ausente: ${autor}`);
}

payload.versao = 7;
payload.total = 1000;
payload.composicao = {
  autoraisCamilaMartins: ordenadas.filter(x => normalizar(x.autor) === normalizar("Camila Martins")).length,
  citacoesAutores: ordenadas.filter(x => normalizar(x.autor) !== normalizar("Camila Martins")).length,
  autoresExternos: new Set(ordenadas.filter(x => normalizar(x.autor) !== normalizar("Camila Martins")).map(x => normalizar(x.autor))).size
};
payload.ordenacao = "Pseudoaleatória determinística, sem o mesmo autor em dias consecutivos e sem repetição até completar o ciclo de 1000 dias.";
payload.autoresGarantidos = autoresObrigatorios;
payload.frases = ordenadas;

await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`SUCESSO V7: ${ordenadas.length} frases; sem autores consecutivos; autores garantidos: ${autoresObrigatorios.join(", ")}.`);
