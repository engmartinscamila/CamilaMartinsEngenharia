// Gera assets/frases-do-dia.json (v8) a partir do acervo revisado, sem rede.
// A ordem garante que o mesmo autor nunca aparece em dois dias seguidos (inclusive na virada do ciclo).
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { AUTORAIS, CITACOES } from "./frases-do-dia-curadoria.mjs";

const OUT = "assets/frases-do-dia.json";
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const categoria = (t) => {
  t = norm(t);
  if (/alegr|feliz|riso|rir|sorri|cant|music|danc/.test(t)) return "Alegria";
  if (/corag|ous|medo|audaz|temer|derrot|levant/.test(t)) return "Coragem";
  if (/paz|seren|calma|tranquil|descans|paciencia|pacien/.test(t)) return "Paz";
  if (/esperanc|sonh|estrela|sol |sol,|verao|madrugada|amanha/.test(t)) return "Esperança";
  if (/amig|amor|ama|bondade|gentil|generos|gratid|ternura/.test(t)) return "Amor e amizade";
  if (/forc|firme|persever|constan|lut|adversid|dificuld|perseveran|tentar|vencer|fracass|falh/.test(t)) return "Força";
  if (/aprend|ensin|saber|sabedor|conhec|pens|pergunt|curios|verdade|ideia/.test(t)) return "Sabedoria";
  if (/vida|viver|vivo|dia|tempo|presente|caminh|jornada/.test(t)) return "Vida";
  if (/arte|cria|imagin|belez|obra|constru|arquitet|invent/.test(t)) return "Criação";
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

// Ordenação: cada autor tem suas frases distribuídas de forma uniforme ao longo do ano
// (posição ideal = (k + deslocamento) * total / quantidade). Depois, um reparo local garante
// que o mesmo autor nunca apareça em dias seguidos.
const porAutor = new Map();
for (const item of itens) {
  if (!porAutor.has(item.autor)) porAutor.set(item.autor, []);
  porAutor.get(item.autor).push(item);
}
const total = itens.length;
const deslocamento = (autor) => (parseInt(createHash("sha256").update(autor).digest("hex").slice(0, 8), 16) / 0xffffffff);
const posicionados = [];
for (const [autor, lista] of porAutor) {
  const d = deslocamento(autor);
  lista.forEach((item, k) => posicionados.push({ item, alvo: ((k + d) * total) / lista.length }));
}
const ordem = posicionados.sort((a, b) => a.alvo - b.alvo || a.item.autor.localeCompare(b.item.autor, "pt-BR")).map((x) => x.item);
const conflito = (i) => ordem[i].autor === ordem[(i + 1) % total].autor;
for (let volta = 0; volta < 50 && ordem.some((_, i) => conflito(i)); volta++) {
  for (let i = 0; i < total; i++) {
    if (!conflito(i)) continue;
    const j = (i + 1) % total;
    // troca o segundo item do par com o vizinho mais próximo que não crie novo conflito
    for (let dist = 2; dist < total; dist++) {
      const k = (i + dist) % total;
      const autorK = ordem[k].autor, autorJ = ordem[j].autor;
      const vizinhosK = [ordem[(k - 1 + total) % total].autor, ordem[(k + 1) % total].autor];
      const vizinhosJ = [ordem[i].autor, ordem[(j + 1) % total].autor];
      if (autorK !== ordem[i].autor && !vizinhosK.includes(autorJ) && !vizinhosJ.includes(autorK) && autorK !== autorJ) {
        [ordem[j], ordem[k]] = [ordem[k], ordem[j]];
        break;
      }
    }
  }
}
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
