import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function cleanRef(ref = "") {
  return String(ref).trim().replace(/[?#].*$/, "");
}
function isExternal(ref) {
  return /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|#)/i.test(ref);
}
function normalizeRef(baseFile, ref) {
  const cleaned = cleanRef(ref);
  if (!cleaned || isExternal(cleaned)) return null;
  if (cleaned.startsWith("//")) return null;
  if (cleaned.startsWith("/")) return cleaned.replace(/^\/+/, "");
  return path.normalize(path.join(path.dirname(baseFile), cleaned)).replaceAll("\\", "/");
}
function extract(content, regex, group = 1) {
  return [...content.matchAll(regex)].map(match => match[group]).filter(Boolean);
}

const rootFiles = fs.readdirSync(ROOT);
const htmlFiles = rootFiles.filter(name => name.endsWith(".html")).sort();
const jsFiles = fs.readdirSync(path.join(ROOT, "js")).filter(name => name.endsWith(".js")).sort();
const cssFiles = fs.readdirSync(path.join(ROOT, "css")).filter(name => name.endsWith(".css")).sort();

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf8");

  const ids = extract(content, /\bid\s*=\s*["']([^"']+)["']/gi);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(`${file}: IDs duplicados: ${duplicateIds.join(", ")}`);

  const refs = [
    ...extract(content, /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi),
    ...extract(content, /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi),
    ...extract(content, /<(?:img|source|video|audio)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi),
    ...extract(content, /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)
  ];

  for (const ref of refs) {
    const local = normalizeRef(file, ref);
    if (!local) continue;

    // Rotas sem extensão podem ser âncoras/rotas intencionais. Verificamos arquivos explícitos.
    if (!path.extname(local)) continue;
    if (!exists(local)) fail(`${file}: referência local inexistente -> ${ref} (${local})`);
  }

  const scripts = extract(content, /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)
    .map(cleanRef)
    .filter(src => src.startsWith("js/"));

  const duplicateScripts = [...new Set(scripts.filter((src, index) => scripts.indexOf(src) !== index))];
  if (duplicateScripts.length) fail(`${file}: scripts duplicados: ${duplicateScripts.join(", ")}`);

  if (content.includes("camilamartinsengenharia.pages.dev")) {
    fail(`${file}: ainda referencia Cloudflare Pages`);
  }
  if (/portal-app\//i.test(content)) {
    fail(`${file}: referencia o portal-app antigo`);
  }
}

const restrictedAdmin = [
  "admin.html","clientes.html","projetos.html","documentos.html","biblioteca.html",
  "fotos.html","financeiro.html","agenda.html","cronograma.html","solicitacoes.html",
  "configuracoes.html","protecao-pdf-admin.html"
];

for (const file of restrictedAdmin) {
  if (!exists(file)) { fail(`Página administrativa ausente: ${file}`); continue; }
  const content = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const required of ["js/supabase.js", "js/auth.js", "js/ui-core.js"]) {
    if (!content.includes(required)) fail(`${file}: não carrega ${required}`);
  }
  if (file !== "protecao-pdf-admin.html" && !content.includes("js/database.js")) {
    fail(`${file}: não carrega js/database.js`);
  }
}

const frasesPath = path.join(ROOT, "assets/frases-do-dia.json");
if (!fs.existsSync(frasesPath)) {
  fail("Acervo da Frase do dia ausente.");
} else {
  try {
    const acervo = JSON.parse(fs.readFileSync(frasesPath, "utf8"));
    const frases = Array.isArray(acervo.frases) ? acervo.frases : [];
    const suspeita = /[_*`<>]|\b(?:n['’]um|n['’]uma|d['’]um|d['’]uma|d['’]elle|d['’]ella|scenas?|polycarpo|yaya|pharmacia|acceitar|ahi)\b/i;
    if (frases.length !== 1000) fail(`Frase do dia: esperado acervo explícito de 1000 frases; encontrado ${frases.length}.`);
    const textos = new Set();
    frases.forEach((item, index) => {
      const texto = String(item?.texto || "").trim();
      if (!texto) fail(`Frase do dia: texto vazio na posição ${index + 1}.`);
      if (suspeita.test(texto)) fail(`Frase do dia: grafia antiga ou marcação indevida na posição ${index + 1}: ${texto}`);
      if (!texto.endsWith(".")) fail(`Frase do dia: pontuação final ausente na posição ${index + 1}.`);
      textos.add(texto.toLocaleLowerCase("pt-BR"));
    });
    if (textos.size !== frases.length) fail("Frase do dia: existem frases duplicadas no acervo.");
  } catch (error) {
    fail(`Frase do dia: JSON inválido — ${error.message}`);
  }
}

const adminHtml = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
for (const obsolete of ["admin-ui-resilience.js", "admin-dashboard-fix.js", "dashboard-biblioteca-fix.js"]) {
  if (adminHtml.includes(obsolete)) fail(`admin.html ainda carrega script concorrente: ${obsolete}`);
}
if ((adminHtml.match(/js\/admin\.js/g) || []).length !== 1) {
  fail("admin.html deve carregar js/admin.js exatamente uma vez");
}

const cadastro = fs.readFileSync(path.join(ROOT, "js/cadastro-inteligente.js"), "utf8");
if (/new\s+MutationObserver|MutationObserver\s*\(/.test(cadastro)) {
  fail("cadastro-inteligente.js contém MutationObserver; risco de regressão do congelamento");
}

for (const js of jsFiles) {
  const file = path.join(ROOT, "js", js);
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    fail(`js/${js}: erro de sintaxe JavaScript\n${String(error.stderr || error.message)}`);
  }
}

try {
  execFileSync(process.execPath, ["scripts/notification-privacy-test.mjs"], {
    cwd: ROOT,
    stdio: "pipe"
  });
} catch (error) {
  fail(`Filtro de privacidade das notificações falhou\n${String(error.stderr || error.message)}`);
}

for (const css of cssFiles) {
  const rel = `css/${css}`;
  const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const refs = extract(content, /url\(\s*["']?([^"')]+)["']?\s*\)/gi);
  for (const ref of refs) {
    const local = normalizeRef(rel, ref);
    if (!local || !path.extname(local)) continue;
    if (!exists(local)) fail(`${rel}: url() aponta para arquivo inexistente -> ${ref}`);
  }
}

const galleryPath = "assets/projetos/galeria.json";
if (exists(galleryPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, galleryPath), "utf8"));
    const workerPrefix = "https://cme-public-media.eng-martins-camila.workers.dev/media/";

    const validarMidia = (ref, storagePath, contexto) => {
      if (!ref) return;

      if (/^https?:\/\//i.test(ref)) {
        if (!ref.startsWith(workerPrefix)) {
          fail(`${galleryPath}: ${contexto} aponta para origem remota não autorizada -> ${ref}`);
          return;
        }

        if (!String(storagePath || "").startsWith("portfolio/")) {
          fail(`${galleryPath}: ${contexto} remota sem storagePath válido -> ${ref}`);
        }
        return;
      }

      const cleaned = cleanRef(ref);
      const local = cleaned.startsWith("assets/")
        ? cleaned
        : normalizeRef(galleryPath, ref);

      if (local && !exists(local)) {
        fail(`${galleryPath}: ${contexto} local inexistente -> ${ref}`);
      }
    };

    for (const [projectIndex, project] of (raw.projetos || []).entries()) {
      for (const [imageIndex, image] of (project.imagens || []).entries()) {
        validarMidia(
          image?.src,
          image?.storagePath,
          `projeto ${projectIndex + 1}, imagem ${imageIndex + 1}`
        );
      }

      for (const [videoIndex, video] of (project.videos || []).entries()) {
        validarMidia(
          video?.src,
          video?.storagePath,
          `projeto ${projectIndex + 1}, vídeo ${videoIndex + 1}`
        );

        if (video?.poster) {
          validarMidia(
            video.poster,
            video.posterStoragePath,
            `projeto ${projectIndex + 1}, poster do vídeo ${videoIndex + 1}`
          );
        }
      }
    }
  } catch (error) {
    fail(`${galleryPath}: JSON inválido: ${error.message}`);
  }
}

const cname = fs.readFileSync(path.join(ROOT, "CNAME"), "utf8").trim();
if (cname !== "camilamartinsengenharia.com.br") {
  fail(`CNAME inesperado: ${cname}`);
}

const rootTextFiles = [...htmlFiles.map(f => path.join(ROOT, f)), ...jsFiles.map(f => path.join(ROOT, "js", f))];
for (const file of rootTextFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("camilamartinsengenharia.pages.dev")) {
    fail(`${path.relative(ROOT, file)}: referência residual a Cloudflare Pages`);
  }
}

console.log(`Auditoria estática: ${htmlFiles.length} HTML, ${jsFiles.length} JS, ${cssFiles.length} CSS.`);
for (const message of warnings) console.warn("AVISO:", message);
if (errors.length) {
  console.error("\nERROS ENCONTRADOS:");
  errors.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exit(1);
}
console.log("AUDITORIA ESTÁTICA APROVADA.");
