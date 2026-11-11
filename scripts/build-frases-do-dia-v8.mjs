// Gera assets/frases-do-dia.json (v8) a partir do acervo revisado, sem rede.
// A ordem garante que o mesmo autor nunca aparece em dois dias seguidos (inclusive na virada do ciclo).
import { writeFile } from "node:fs/promises";
import { AUTORAIS, CITACOES } from "./frases-do-dia-curadoria.mjs";

const OUT = "assets/frases-do-dia.json";
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const categoria = (t) => {
  t = norm(t);
  if (/imagina|criativ|arte|curva|beleza/.test(t)) return "Criatividade";
  if (/conhec|aprend|sabe|intelig|mente|pens|curios|descobert|ensina/.test(t)) return "Conhecimento";
  if (/corag|medo|falh|fracass|desist/.test(t)) return "Coragem";
  if (/persist|discipl|esfor|habito|constan|consisten|motiva/.test(t)) return "Persistência";
  if (/tempo|pacien|relogio/.test(t)) return "Paciência";
  if (/clarez|simplic|menos e mais|perfeic/.test(t)) return "Clareza";
  if (/qualidade|excelen|detalhe|bem-feita|bem construido|obra|projeto|constru/.test(t)) return "Excelência";
  if (/meta|prior|decis|escolh|planej|foco/.test(t)) return "Planejamento";
  return "Reflexão";
};

const itens = [
  ...AUTORAIS.map((texto) => ({ texto, autor: "Camila Martins", categoria: categoria(texto), fonte: "Autoral", origem: "autoral" })),
  ...CITACOES.map(([texto, autor, ref]) => ({ texto, autor, categoria: categoria(texto), fonte: ref, origem: "citação" })),
];

for (const [i, item] of itens.entries()) {
  if (!item.texto || !item.autor) throw new Error(`Frase ${i + 1} sem texto ou autor.`);
  if (!/[.!?]$/.test(item.texto)) throw new Error(`Frase sem pontuação final: ${item.texto}`);
}
if (new Set(itens.map((x) => norm(x.texto))).size !== itens.length) throw new Error("Frases duplicadas no acervo.");

// Ordenação: frases da Camila intercaladas com citações; as citações seguem rodízio de autores
// (primeiro uma de cada autor, depois as segundas), e as excedentes ficam espalhadas pelo ciclo.
const autorais = itens.filter((x) => x.origem === "autoral");
const porAutor = new Map();
for (const item of itens.filter((x) => x.origem !== "autoral")) {
  if (!porAutor.has(item.autor)) porAutor.set(item.autor, []);
  porAutor.get(item.autor).push(item);
}
const externas = [];
for (let rodada = 0; externas.length < itens.length - autorais.length; rodada++) {
  for (const fila of porAutor.values()) if (fila[rodada]) externas.push(fila[rodada]);
}
const extras = externas.length - autorais.length;
const passo = extras > 0 ? Math.floor(autorais.length / extras) : Infinity;
const ordem = [];
let e = 0;
for (let i = 0; i < autorais.length; i++) {
  ordem.push(autorais[i]);
  ordem.push(externas[e++]);
  if (extras > 0 && (i + 1) % passo === 0 && e < externas.length && ordem.length < itens.length - (autorais.length - i - 1) * 2) ordem.push(externas[e++]);
}
while (e < externas.length) ordem.push(externas[e++]);
// Virada do ciclo: o último dia não pode ter o mesmo autor do primeiro.
if (ordem.at(-1).autor === ordem[0].autor) {
  const i = ordem.findIndex((x, k) => k > 0 && k < ordem.length - 1 && x.autor !== ordem[0].autor && ordem[k - 1].autor !== ordem.at(-1).autor && ordem[k + 1]?.autor !== ordem.at(-1).autor);
  if (i < 0) throw new Error("Não foi possível ajustar a virada do ciclo.");
  [ordem[i], ordem[ordem.length - 1]] = [ordem[ordem.length - 1], ordem[i]];
}
for (let i = 0; i < ordem.length; i++) {
  if (ordem[i].autor === ordem[(i + 1) % ordem.length].autor) throw new Error(`Autor repetido em sequência: ${ordem[i].autor} (posição ${i + 1}).`);
}

const autoresExternos = new Set(CITACOES.map(([, autor]) => autor)).size;
await writeFile(OUT, JSON.stringify({
  versao: 8,
  timezone: "America/Sao_Paulo",
  total: ordem.length,
  composicao: { autoraisCamilaMartins: AUTORAIS.length, citacoesAutores: CITACOES.length, autoresExternos },
  regraSelecao: "Uma frase por dia, na ordem do acervo (dias desde 01/01/1970 no fuso de São Paulo, módulo total). A ordem nunca repete o mesmo autor em dias seguidos.",
  politicaEditorial: "Acervo revisado manualmente: autoria verificada, sem trechos soltos de romances, grafia antiga, letras de música, política ou religião.",
  frases: ordem,
}, null, 2) + "\n");
console.log(`SUCESSO V8: ${ordem.length} frases (${AUTORAIS.length} da Camila + ${CITACOES.length} citações de ${autoresExternos} autores); nenhum autor repetido em dias seguidos.`);
