import { readFile, writeFile } from "node:fs/promises";

const OUT = "assets/frases-do-dia.json";
const VERSAO = 8;
const PADRAO_SUSPEITO = /[_*`<>]|\b(?:n['’]um|n['’]uma|d['’]um|d['’]uma|d['’]elle|d['’]ella|scenas?|polycarpo|yaya|pharmacia|acceitar|ahi)\b/i;

function textoLimpo(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function validarParte(valor, tipo, indice) {
  const texto = textoLimpo(valor);
  if (!texto) throw new Error(`${tipo} ${indice + 1} está vazio.`);
  if (PADRAO_SUSPEITO.test(texto)) {
    throw new Error(`${tipo} ${indice + 1} contém grafia antiga ou marcação indevida: ${texto}`);
  }
  if (tipo === "Início" && !/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/u.test(texto)) {
    throw new Error(`${tipo} ${indice + 1} deve começar com letra maiúscula: ${texto}`);
  }
  if (tipo === "Final" && !/^[a-záéíóúâêôãõç]/u.test(texto)) {
    throw new Error(`${tipo} ${indice + 1} deve começar com letra minúscula: ${texto}`);
  }
  return texto.replace(/[.;]+$/, "");
}

function validarFrase(frase, indice) {
  const texto = textoLimpo(frase.texto);
  if (texto.length < 55 || texto.length > 260) {
    throw new Error(`Frase ${indice + 1} tem tamanho inadequado: ${texto.length} caracteres.`);
  }
  if (!texto.endsWith(".")) throw new Error(`Frase ${indice + 1} não termina com ponto.`);
  if (PADRAO_SUSPEITO.test(texto)) {
    throw new Error(`Frase ${indice + 1} contém grafia antiga ou marcação indevida: ${texto}`);
  }
  if (/\s{2,}|\s+[,.!?;:]/.test(texto)) {
    throw new Error(`Frase ${indice + 1} contém espaçamento ou pontuação irregular: ${texto}`);
  }
}

const fonte = JSON.parse(await readFile(OUT, "utf8"));
const inicios = (Array.isArray(fonte.inicios) ? fonte.inicios : []).map((item, indice) =>
  validarParte(item, "Início", indice)
);
const finais = (Array.isArray(fonte.finais) ? fonte.finais : []).map((item, indice) =>
  validarParte(item, "Final", indice)
);
const categorias = (Array.isArray(fonte.categorias) ? fonte.categorias : [])
  .map(textoLimpo)
  .filter(Boolean);

if (inicios.length !== 40) throw new Error(`O acervo deve ter 40 inícios revisados; encontrou ${inicios.length}.`);
if (finais.length !== 25) throw new Error(`O acervo deve ter 25 finais revisados; encontrou ${finais.length}.`);
if (!categorias.length) throw new Error("As categorias do acervo estão vazias.");

const frases = [];
for (let rodada = 0; rodada < finais.length; rodada += 1) {
  for (let inicioIndice = 0; inicioIndice < inicios.length; inicioIndice += 1) {
    const finalIndice = (rodada + inicioIndice * 7) % finais.length;
    const frase = {
      texto: `${inicios[inicioIndice]}; ${finais[finalIndice]}.`,
      autor: textoLimpo(fonte.autor) || "Editorial Camila Martins Engenharia",
      categoria: categorias[(inicioIndice + finalIndice) % categorias.length],
      fonte: "Acervo editorial revisado em português atual",
      origem: "editorial"
    };
    validarFrase(frase, frases.length);
    frases.push(frase);
  }
}

const unicas = new Set(frases.map(item => item.texto.toLocaleLowerCase("pt-BR")));
if (frases.length !== 1000 || unicas.size !== 1000) {
  throw new Error(`Acervo inválido: ${frases.length} frases e ${unicas.size} textos únicos.`);
}

for (let indice = 1; indice < frases.length; indice += 1) {
  const anterior = frases[indice - 1].texto.split(";")[0];
  const atual = frases[indice].texto.split(";")[0];
  if (anterior === atual) throw new Error(`Início repetido em dias consecutivos na posição ${indice + 1}.`);
}

const payload = {
  versao: VERSAO,
  timezone: fonte.timezone || "America/Sao_Paulo",
  autor: textoLimpo(fonte.autor) || "Editorial Camila Martins Engenharia",
  total: frases.length,
  composicao: {
    editoriaisRevisadas: frases.length,
    trechosAutomaticosDeLivros: 0,
    citacoesExternasNaoRevisadas: 0
  },
  politicaEditorial: "Português brasileiro atual, sem trechos automáticos, grafia antiga ou marcações editoriais.",
  validacao: "Todas as 1000 frases são verificadas durante a publicação quanto a unicidade, pontuação, espaçamento e padrões de grafia antiga.",
  categorias,
  inicios,
  finais,
  frases
};

await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`SUCESSO V${VERSAO}: ${frases.length} frases editoriais revisadas; nenhuma citação automática de livros.`);
