import { readFile } from "node:fs/promises";

// A versão anterior deste script reconstruía o acervo como 1.000 combinações
// editoriais do mesmo autor. Isso anulava a diversidade histórica do portal.
// O gerador fixado abaixo preserva a composição original: textos autorais da
// Camila + trechos de autores clássicos de fontes fixadas, com filtros editoriais.
await import("./build-frases-do-dia-fixed.mjs");

const OUT = "assets/frases-do-dia.json";
const payload = JSON.parse(await readFile(OUT, "utf8"));
const frases = Array.isArray(payload?.frases) ? payload.frases : [];

if (frases.length < 700) {
  throw new Error(`Acervo restaurado insuficiente: esperado ao menos 700, encontrado ${frases.length}.`);
}

const normalizar = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const textos = new Set();
const autores = new Set();
for (const [index, item] of frases.entries()) {
  const texto = String(item?.texto ?? "").trim();
  const autor = String(item?.autor ?? "").trim();
  if (!texto || !autor) throw new Error(`Frase ${index + 1} sem texto ou autor.`);
  const chave = normalizar(texto);
  if (textos.has(chave)) throw new Error(`Frase duplicada na posição ${index + 1}.`);
  textos.add(chave);
  autores.add(normalizar(autor));
}

if (autores.size < 8) {
  throw new Error(`O acervo voltou a perder diversidade: somente ${autores.size} autores.`);
}

if (![...autores].some(author => author === normalizar("Camila Martins"))) {
  throw new Error("As frases autorais da Camila Martins desapareceram do acervo.");
}

console.log(`SUCESSO V7: ${frases.length} frases únicas; ${autores.size} autores; diversidade restaurada e grafia histórica filtrada.`);
