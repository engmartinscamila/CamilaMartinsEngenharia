import { readFile } from "node:fs/promises";

// A versão anterior deste script reconstruía o acervo como 1.000 combinações
// editoriais do mesmo autor. Isso anulava a diversidade histórica do portal.
// O gerador fixado abaixo preserva a composição original: textos autorais da
// Camila + trechos de autores clássicos de fontes fixadas, com filtros editoriais.
await import("./build-frases-do-dia-fixed.mjs");
await import("./validate-frases-do-dia.mjs");
