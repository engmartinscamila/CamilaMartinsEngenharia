import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SITE_BASE || "http://127.0.0.1:4173";
const ROOT = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const dbNames = new Set();
for (const name of fs.readdirSync(path.join(ROOT, "js")).filter(name => name.endsWith(".js"))) {
  const content = fs.readFileSync(path.join(ROOT, "js", name), "utf8");
  for (const match of content.matchAll(/\b(db[A-ZÀ-Ý_a-z0-9]+)\b/g)) dbNames.add(match[1]);
}

const databaseMock = `
(function(){
  const cliente = {id:"c1", nome:"Cliente Teste", email:"cliente@teste.local", status:"ativo", parceria:false};
  const projeto = {id:"p1", cliente_id:"c1", nome:"Projeto Teste", status:"em_andamento", numero_contrato:"TESTE-001", parceria:false};
  const documento = {id:"d1", cliente_id:"c1", projeto_id:"p1", nome:"Documento Teste", titulo:"Documento Teste", tipo:"projeto", nome_original:"teste.pdf"};
  const foto = {id:"f1", cliente_id:"c1", projeto_id:"p1", nome:"Foto Teste", arquivo:"teste.webp"};
  const biblioteca = {id:"b1", cliente_id:"c1", projeto_id:"p1", nome:"Arquivo Teste", tipo:"guia_estilos"};
  const samples = {clientes:[cliente], projetos:[projeto], documentos:[documento], fotos:[foto], biblioteca:[biblioteca]};
  function result(name,args){
    const lower=name.toLowerCase();
    if(lower.includes("clientes")) return samples.clientes;
    if(lower.includes("projetos")) return samples.projetos;
    if(lower.includes("documentos")) return samples.documentos;
    if(lower.includes("fotos")) return samples.fotos;
    if(lower.includes("biblioteca")) return samples.biblioteca;
    if(lower.includes("agenda")) return [];
    if(lower.includes("cronograma")) return [];
    if(lower.includes("solicitacoes")) return [];
    if(lower.includes("financeiro")) return [];
    if(lower.includes("configuracoes")) return {};
    if(lower.includes("porid") || lower.includes("detalhe")) return {...cliente,...projeto};
    if(lower.includes("criar") || lower.includes("editar")) return {...(args[0]||{}), id:(args[0]||{}).id||"mock-id"};
    if(lower.includes("excluir") || lower.includes("remover")) return true;
    return [];
  }
  window.__DB_CALLS__ = [];
  const names = ${JSON.stringify([...dbNames])};
  for(const name of names){
    window[name]=async function(...args){
      window.__DB_CALLS__.push({name,args});
      return result(name,args);
    };
  }
})();
`;

const supabaseMock = `
(function(){
  window.ADMIN_UID = "admin-test";
  window.CM_CONFIG = { limiteArmazenamentoBytes: 1073741824, storageLimitBytes:1073741824 };
  window.TABELAS = Object.freeze({
    CLIENTES:"clientes",
    AGENDA:"agenda",
    PROJETOS:"projetos",
    DOCUMENTOS:"documentos",
    FOTOS:"fotos",
    BIBLIOTECA:"biblioteca",
    FINANCEIRO:"financeiro",
    CONFIGURACOES:"configuracoes",
    CRONOGRAMA:"cronograma",
    SOLICITACOES:"solicitacoes",
    SOLICITACAO_RESPOSTAS:"solicitacao_respostas"
  });
  window.BUCKETS = Object.freeze({
    DOCUMENTOS:"documentos",
    FOTOS:"fotos",
    BIBLIOTECA:"biblioteca"
  });
  const forceClient = new URLSearchParams(location.search).get("role") === "client";
  const isAdmin = !forceClient && /(?:admin|clientes|projetos|documentos|biblioteca|fotos|financeiro|agenda|cronograma|solicitacoes|configuracoes|protecao-pdf-admin)\\.html$/i.test(location.pathname);
  const user = { id: isAdmin ? "admin-test" : "client-test", email: isAdmin ? "admin@teste.local" : "cliente@teste.local", user_metadata:{nome:isAdmin?"Camila Teste":"Cliente Teste"} };
  const session = { user, access_token:"mock-token" };

  const sample = {
    clientes:[{id:"c1", user_id:"client-test", nome:"Cliente Teste", email:"cliente@teste.local", status:"ativo", parceria:false}],
    projetos:[{id:"p1", cliente_id:"c1", nome:"Projeto Teste", status:"em_andamento", numero_contrato:"TESTE-001", parceria:false}],
    documentos:[{id:"d1", cliente_id:"c1", projeto_id:"p1", nome:"Documento Teste", titulo:"Documento Teste", tipo:"projeto", nome_original:"teste.pdf"}],
    fotos:[{id:"f1", cliente_id:"c1", projeto_id:"p1", nome:"Foto Teste", arquivo:"teste.webp"}],
    biblioteca:[{id:"b1", cliente_id:"c1", projeto_id:"p1", nome:"Arquivo Teste", tipo:"guia_estilos"}],
    agenda:[], cronograma:[], solicitacoes:[], financeiro:[], configuracoes:[]
  };

  function chain(table){
    const state={single:false};
    const api={
      select(){return api}, eq(){return api}, neq(){return api}, gt(){return api}, gte(){return api},
      lt(){return api}, lte(){return api}, in(){return api}, is(){return api}, not(){return api},
      match(){return api}, order(){return api}, limit(){return api}, range(){return api},
      insert(){return api}, update(){return api}, upsert(){return api}, delete(){return api},
      maybeSingle(){ return Promise.resolve({data:(sample[table]||[])[0]||null,error:null}); },
      single(){ return Promise.resolve({data:(sample[table]||[])[0]||null,error:null}); },
      then(resolve,reject){ return Promise.resolve({data:sample[table]||[],error:null,count:(sample[table]||[]).length}).then(resolve,reject); }
    };
    return api;
  }

  window.obterContextoPortal = async function(session){
    if(!session?.user) return {redirecionar:"login.html"};
    if(session.user.id === window.ADMIN_UID && !location.search.includes("preview=1")){
      return {redirecionar:"admin.html"};
    }
    return {
      cliente: sample.clientes[0],
      modoPreview: false,
      parametrosPreview: ""
    };
  };
  window.aplicarContextoPortal = function(){};

  window.supabaseClient = {
    auth:{
      getSession: async()=>({data:{session},error:null}),
      getUser: async()=>({data:{user},error:null}),
      signInWithPassword: async()=>({data:{session,user},error:null}),
      signUp: async()=>({data:{session:null,user},error:null}),
      resetPasswordForEmail: async()=>({data:{},error:null}),
      signOut: async()=>({error:null}),
      onAuthStateChange: ()=>({data:{subscription:{unsubscribe(){}}}})
    },
    from: table => chain(table),
    rpc: async name => ({data:name==="uso_armazenamento_portal"?{bytes_utilizados:1048576,quantidade_arquivos:3}:[],error:null}),
    storage:{
      from: ()=>({
        upload:async()=>({data:{path:"mock/path"},error:null}),
        remove:async()=>({data:[],error:null}),
        list:async()=>({data:[],error:null}),
        createSignedUrl:async()=>({data:{signedUrl:"https://example.invalid/mock"},error:null}),
        getPublicUrl:()=>({data:{publicUrl:"https://example.invalid/mock"}})
      })
    }
  };
})();
`;

async function installMocks(page) {
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", route =>
    route.fulfill({ status:200, contentType:"application/javascript", body:"window.supabase={createClient:()=>window.supabaseClient};" })
  );
  await page.route("**/js/supabase.js*", route =>
    route.fulfill({ status:200, contentType:"application/javascript", body:supabaseMock })
  );
  await page.route("**/js/database.js*", route =>
    route.fulfill({ status:200, contentType:"application/javascript", body:databaseMock })
  );
  await page.route("https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.tus={Upload:function(){this.start=function(){};this.abort=function(){}}};"
    })
  );
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, route => route.abort());
}

async function responsive(page, label) {
  try {
    const value = await Promise.race([
      page.evaluate(() => new Promise(resolve => setTimeout(() => resolve("ok"), 0))),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500))
    ]);
    assert(value === "ok", `${label}: thread principal não respondeu`);
  } catch {
    failures.push(`${label}: página congelou / não respondeu`);
  }
}

async function loadPage(context, file) {
  const page = await context.newPage();
  const pageErrors = [];
  page.__cmePageErrors = pageErrors;
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", dialog => dialog.accept().catch(()=>{}));
  await installMocks(page);
  await page.goto(`${BASE}/${file}?teste=${Date.now()}`, { waitUntil:"domcontentloaded", timeout:15000 });
  await page.waitForTimeout(900);
  await responsive(page, file);
  assert(pageErrors.length === 0, `${file}: erros JS: ${pageErrors.join(" | ")}`);
  return page;
}

const browser = await chromium.launch({headless:true});
const context = await browser.newContext();

const adminPages = [
  "admin.html","clientes.html","projetos.html","documentos.html","biblioteca.html",
  "fotos.html","financeiro.html","agenda.html","cronograma.html","solicitacoes.html","configuracoes.html",
  "protecao-pdf-admin.html"
];

for (const file of adminPages) {
  const page = await loadPage(context, file);
  const loading = page.locator("#loading");
  if (await loading.count()) {
    await page.waitForTimeout(1200);
    const visible = await loading.isVisible().catch(()=>false);
    assert(!visible, `${file}: loading permaneceu bloqueando a interface`);
  }

  const menuLinks = await page.locator("a.menu-item").count();
  assert(menuLinks >= 5, `${file}: menu lateral incompleto (${menuLinks} links)`);

  await page.close();
}

const modalTests = [
  ["admin.html","novoCliente","modalCliente"],
  ["clientes.html","novoCliente","modalCliente"],
  ["projetos.html","novoProjeto","modalProjeto"],
  ["documentos.html","novoDocumento","modalDocumento"],
  ["biblioteca.html","novoArquivo","modalArquivo"],
  ["fotos.html","novaFoto","modalFoto"],
  ["financeiro.html","novoLancamento","modalFinanceiro"],
  ["agenda.html","novoEvento","modalEvento"],
  ["solicitacoes.html","novaSolicitacao","modalSolicitacao"]
];

for (const [file, buttonId, modalId] of modalTests) {
  const page = await loadPage(context, file);
  const button = page.locator(`#${buttonId}`);
  const modal = page.locator(`#${modalId}`);
  assert(await button.count() === 1, `${file}: botão #${buttonId} ausente`);
  assert(await modal.count() === 1, `${file}: modal #${modalId} ausente`);
  if (await button.count() && await modal.count()) {
    await button.click({timeout:3000}).catch(error => failures.push(`${file}: clique #${buttonId} falhou: ${error.message}`));
    await page.waitForTimeout(100);
    const opened = await modal.evaluate(el => el.classList.contains("show") || getComputedStyle(el).display !== "none").catch(()=>false);
    assert(opened, `${file}: #${buttonId} não abriu #${modalId}`);
  }
  await responsive(page, `${file} após clique ${buttonId}`);
  await page.close();
}


async function preencherCampo(page, id, valor) {
  const campo = page.locator(`#${id}`);
  if (await campo.count() !== 1) {
    failures.push(`${page.url()}: campo #${id} ausente`);
    return;
  }

  const tag = await campo.evaluate(el => el.tagName.toLowerCase());
  const type = await campo.getAttribute("type") || "";

  if (tag === "select") {
    const options = await campo.locator("option").evaluateAll(opts =>
      opts.map((o,index)=>({index,value:o.value,disabled:o.disabled}))
          .filter(o=>!o.disabled && o.value)
    );
    if (!options.length) {
      failures.push(`${page.url()}: select #${id} sem opção válida`);
      return;
    }
    const byValue = options.find(o => String(o.value) === String(valor));
    await campo.selectOption(byValue ? byValue.value : {index:options[0].index});
    return;
  }

  if (type === "file") {
    const arquivos = Array.isArray(valor) ? valor : [valor];
    await campo.setInputFiles(arquivos.map((name,index)=>({
      name: name || `teste-${index}.txt`,
      mimeType: (name || "").endsWith(".webp") ? "image/webp" : "application/pdf",
      buffer: Buffer.from("arquivo de teste automatizado")
    })));
    return;
  }

  if (type === "checkbox") {
    if (valor) await campo.check();
    else await campo.uncheck();
    return;
  }

  await campo.fill(String(valor));
}

const formTests = [
  {
    file:"clientes.html", open:"novoCliente", form:"formCliente", expected:"dbCriarCliente",
    fields:{clienteNome:"Cliente QA",clienteEmail:"cliente.qa@example.com",clienteParceria:true}
  },
  {
    file:"projetos.html", open:"novoProjeto", form:"formProjeto", expected:"dbCriarProjeto",
    fields:{projetoNome:"Projeto QA",projetoCliente:"c1",projetoParceria:true}
  },
  {
    file:"documentos.html", open:"novoDocumento", form:"formDocumento", expected:"dbCriarDocumento",
    fields:{documentoNome:"Projeto Executivo QA",documentoCliente:"c1",documentoProjeto:"p1",documentoArquivo:["Projeto_Executivo_QA.pdf"]}
  },
  {
    file:"biblioteca.html", open:"novoArquivo", form:"formArquivo", expected:"dbSalvarArquivoBiblioteca",
    fields:{arquivoNome:"Guia de Estilos QA",arquivoCliente:"c1",arquivoProjeto:"p1",arquivoUpload:["Guia_Estilos_QA.pdf"]}
  },
  {
    file:"fotos.html", open:"novaFoto", form:"formFoto", expected:"dbCriarFoto",
    fields:{fotoCliente:"c1",fotoProjeto:"p1",fotoTitulo:"Foto QA",arquivoFoto:["foto-qa.webp"]}
  },
  {
    file:"financeiro.html", open:"novoLancamento", form:"formFinanceiro", expected:"dbCriarLancamentoFinanceiro",
    fields:{financeiroDescricao:"Lançamento QA",financeiroValor:"100",financeiroData:"2026-08-29"}
  },
  {
    file:"agenda.html", open:"novoEvento", form:"formEvento", expected:"dbCriarEventoAgenda",
    fields:{eventoTitulo:"Evento QA",eventoData:"2026-08-29"}
  },
  {
    file:"solicitacoes.html", open:"novaSolicitacao", form:"formSolicitacao", expected:"dbCriarSolicitacao",
    fields:{tituloSolicitacao:"Solicitação QA",clienteSolicitacao:"c1",mensagemSolicitacao:"Teste automatizado"}
  }
];

for (const teste of formTests) {
  const page = await loadPage(context, teste.file);
  const open = page.locator(`#${teste.open}`);
  if (await open.count() !== 1) {
    failures.push(`${teste.file}: botão #${teste.open} ausente no teste de salvamento`);
    await page.close();
    continue;
  }

  await open.click({timeout:3000}).catch(error =>
    failures.push(`${teste.file}: não abriu formulário para salvar: ${error.message}`)
  );

  for (const [id,valor] of Object.entries(teste.fields)) {
    await preencherCampo(page,id,valor);
  }

  const form = page.locator(`#${teste.form}`);
  if (await form.count() !== 1) {
    failures.push(`${teste.file}: formulário #${teste.form} ausente`);
    await page.close();
    continue;
  }

  await form.evaluate(el => el.requestSubmit());

  await page.waitForFunction(
    expected => (window.__DB_CALLS__ || []).some(call => call.name === expected),
    teste.expected,
    { timeout: 3500 }
  ).catch(() => {});

  await responsive(page, `${teste.file} após salvar`);

  const calls = await page.evaluate(() => window.__DB_CALLS__ || []);
  const nomesChamados = calls.map(call => call.name).join(", ");
  assert(
    calls.some(call => call.name === teste.expected),
    `${teste.file}: salvar não chamou ${teste.expected}. Chamadas observadas: ${nomesChamados || "nenhuma"}`
  );

  if (teste.file === "clientes.html" || teste.file === "projetos.html") {
    const chamada = calls.find(call => call.name === teste.expected);
    const dados = chamada?.args?.[0] || {};
    assert(
      dados.parceria === true,
      `${teste.file}: campo Parceria não chegou ao payload de salvamento`
    );
  }

  assert(
    (page.__cmePageErrors || []).length === 0,
    `${teste.file}: erro JS após salvar: ${(page.__cmePageErrors || []).join(" | ")}`
  );

  await page.close();
}

// Configurações não usa modal: valida o fluxo de salvar diretamente.
{
  const page = await loadPage(context, "configuracoes.html");
  if (await page.locator("#empresaNome").count()) {
    await page.locator("#empresaNome").fill("Camila Martins Engenharia QA");
  }
  const form = page.locator("#formConfiguracoes");
  if (await form.count()) {
    await form.evaluate(el => el.requestSubmit());
    await page.waitForFunction(
      () => (window.__DB_CALLS__ || []).some(call => call.name === "dbSalvarConfiguracoes"),
      null,
      { timeout: 3500 }
    ).catch(() => {});
    await responsive(page, "configuracoes.html após salvar");
    const calls = await page.evaluate(() => window.__DB_CALLS__ || []);
    assert(
      calls.some(call => call.name === "dbSalvarConfiguracoes"),
      "configuracoes.html: salvar não chamou dbSalvarConfiguracoes"
    );
  } else {
    failures.push("configuracoes.html: formConfiguracoes ausente");
  }
  assert(
    (page.__cmePageErrors || []).length === 0,
    `configuracoes.html: erro JS após salvar: ${(page.__cmePageErrors || []).join(" | ")}`
  );
  await page.close();
}


async function selecionarPrimeiraOpcaoValida(page, id) {
  const campo = page.locator(`#${id}`);
  if (await campo.count() !== 1) return false;
  const options = await campo.locator("option").evaluateAll(opts =>
    opts.map((o,index)=>({index,value:o.value,disabled:o.disabled}))
      .filter(o=>!o.disabled && o.value)
  );
  if (!options.length) return false;
  await campo.selectOption(options[0].value);
  return true;
}

// Upload múltiplo + classificação automática de documentos.
{
  const page = await loadPage(context, "documentos.html");
  await page.locator("#novoDocumento").click();
  await preencherCampo(page, "documentoCliente", "c1");
  await page.waitForTimeout(50);
  await preencherCampo(page, "documentoProjeto", "p1");

  const categoria = page.locator("#documentoCategoria");
  if (await categoria.count()) {
    const automatico = await categoria.locator('option[value="automatico"]').count();
    if (automatico) await categoria.selectOption("automatico");
  }

  await preencherCampo(page, "documentoArquivo", [
    "ART_Execucao_QA.pdf",
    "Guia_Estilos_QA.pdf",
    "Laudo_Vistoria_QA.pdf"
  ]);

  await page.locator("#formDocumento").evaluate(el => el.requestSubmit());

  await page.waitForFunction(
    () => (window.__DB_CALLS__ || []).filter(call => call.name === "dbCriarDocumento").length >= 3,
    null,
    {timeout:5000}
  ).catch(()=>{});

  const calls = await page.evaluate(() =>
    (window.__DB_CALLS__ || []).filter(call => call.name === "dbCriarDocumento")
  );

  assert(calls.length >= 3, `documentos.html: upload múltiplo gravou ${calls.length} de 3 documentos`);

  const tipos = calls.map(call => call.args?.[0]?.tipo || call.args?.[0]?.categoria || "");
  for (const esperado of ["art","guia_estilos","laudo"]) {
    assert(
      tipos.includes(esperado),
      `documentos.html: classificação automática não encontrou ${esperado}. Tipos: ${tipos.join(", ")}`
    );
  }

  await responsive(page, "documentos.html após lote");
  await page.close();
}

// Upload múltiplo da Biblioteca com pastas/categorias por arquivo.
{
  const page = await loadPage(context, "biblioteca.html");
  await page.locator("#novoArquivo").click();
  await preencherCampo(page, "arquivoCliente", "c1");
  await page.waitForTimeout(50);
  await preencherCampo(page, "arquivoProjeto", "p1");

  const categoria = page.locator("#arquivoCategoria");
  if (await categoria.count()) {
    const automatico = await categoria.locator('option[value="automatico"]').count();
    if (automatico) await categoria.selectOption("automatico");
  }

  await preencherCampo(page, "arquivoUpload", [
    "Guia_Obras_QA.pdf",
    "ART_Responsabilidade_QA.pdf",
    "Memorial_Descritivo_QA.pdf"
  ]);

  await page.locator("#formArquivo").evaluate(el => el.requestSubmit());

  await page.waitForFunction(
    () => (window.__DB_CALLS__ || []).filter(call => call.name === "dbSalvarArquivoBiblioteca").length >= 3,
    null,
    {timeout:5000}
  ).catch(()=>{});

  const calls = await page.evaluate(() =>
    (window.__DB_CALLS__ || []).filter(call => call.name === "dbSalvarArquivoBiblioteca")
  );

  assert(calls.length >= 3, `biblioteca.html: upload múltiplo gravou ${calls.length} de 3 arquivos`);
  await responsive(page, "biblioteca.html após lote");
  await page.close();
}

// Upload múltiplo de fotos.
{
  const page = await loadPage(context, "fotos.html");
  await page.locator("#novaFoto").click();
  await preencherCampo(page, "fotoCliente", "c1");
  await page.waitForTimeout(50);

  const projetoOk = await selecionarPrimeiraOpcaoValida(page, "fotoProjeto");
  assert(projetoOk, "fotos.html: projetos não foram carregados depois da seleção do cliente");

  await preencherCampo(page, "arquivoFoto", ["fachada-qa.webp","interior-qa.webp"]);
  await page.locator("#formFoto").evaluate(el => el.requestSubmit());

  await page.waitForFunction(
    () => (window.__DB_CALLS__ || []).filter(call => call.name === "dbCriarFoto").length >= 2,
    null,
    {timeout:5000}
  ).catch(()=>{});

  const calls = await page.evaluate(() =>
    (window.__DB_CALLS__ || []).filter(call => call.name === "dbCriarFoto")
  );

  assert(calls.length >= 2, `fotos.html: upload múltiplo gravou ${calls.length} de 2 fotos`);
  await responsive(page, "fotos.html após lote");
  await page.close();
}

const adminNav = [
  ["abrirClientes","clientes.html"],["abrirProjetos","projetos.html"],["abrirDocumentos","documentos.html"],
  ["abrirBiblioteca","biblioteca.html"],["abrirFotos","fotos.html"],["abrirFinanceiro","financeiro.html"],
  ["abrirAgenda","agenda.html"],["abrirConfiguracoes","configuracoes.html"]
];

for (const [buttonId, destination] of adminNav) {
  const page = await loadPage(context, "admin.html");
  const button = page.locator(`#${buttonId}`);
  assert(await button.count() === 1, `admin.html: #${buttonId} ausente`);
  if (await button.count()) {
    await Promise.all([
      page.waitForURL(url => url.pathname.endsWith("/" + destination), {timeout:3000}).catch(()=>null),
      button.click({timeout:3000}).catch(()=>null)
    ]);
    assert(page.url().includes(destination), `admin.html: #${buttonId} não navegou para ${destination}`);
  }
  await page.close();
}

const clientPages = [
  "portal.html","meu-projeto.html","biblioteca-cliente.html","documentos-cliente.html",
  "fotos-cliente.html","agenda-cliente.html","cronograma-cliente.html","solicitacoes-cliente.html"
];

for (const file of clientPages) {
  const page = await loadPage(context, file);
  await responsive(page, file);
  await page.close();
}

// Segurança: uma sessão de Cliente não pode abrir "Conteúdo do site".
{
  const page = await context.newPage();
  await installMocks(page);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto(
    `${BASE}/protecao-pdf-admin.html?role=client`,
    {waitUntil:"domcontentloaded",timeout:15000}
  );

  await page.waitForURL(
    url => url.pathname.endsWith("/portal.html"),
    {timeout:3500}
  ).catch(()=>{});

  assert(
    page.url().includes("/portal.html"),
    "Segurança: Cliente autenticado conseguiu permanecer em protecao-pdf-admin.html"
  );

  assert(
    errors.length === 0,
    `Segurança Conteúdo do site: erros JS: ${errors.join(" | ")}`
  );

  await page.close();
}

// Galeria pública: deve funcionar mesmo quando o manifesto remoto não responde,
// usando a cópia local sem quebrar a página.
{
  const page = await loadPage(context, "galeria-projetos.html");
  await page.waitForTimeout(1200);
  const projetos = await page.locator("#galleryProjects article, #galleryProjects section").count();
  const texto = await page.locator("#galleryProjects").textContent().catch(()=>"");
  assert(
    projetos > 0 || /Tiny House|Vitalle|Casa Urben|Essenza/i.test(texto || ""),
    "galeria-projetos.html: nenhum projeto público foi renderizado"
  );
  await responsive(page, "galeria-projetos.html");
  await page.close();
}

// Login real com Supabase mockado: primeiro acesso e recuperação.
{
  const page = await loadPage(context, "login.html");
  const first = page.locator("#firstAccess");
  if (await first.count()) {
    await first.click();
    await page.waitForTimeout(50);
    const group = page.locator("#confirmarSenhaGroup");
    assert(await group.count() === 1, "login.html: grupo de confirmação de senha ausente");
    if (await group.count()) {
      const hidden = await group.getAttribute("hidden");
      assert(hidden === null, "login.html: Primeiro acesso não exibiu confirmação de senha");
    }
  } else {
    failures.push("login.html: botão Primeiro acesso ausente");
  }
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error("\nFALHAS DE SMOKE TEST:");
  failures.forEach((failure,index)=>console.error(`${index+1}. ${failure}`));
  process.exit(1);
}
console.log("SMOKE TEST APROVADO: Admin, Cliente e Login responderam sem congelamento.");
