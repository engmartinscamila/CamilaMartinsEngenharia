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
  const clientes = [
    {id:"c1", nome:"Cliente Alpha", email:"alpha@teste.local", status:"ativo", parceria:false},
    {id:"c2", nome:"Cliente Beta", email:"beta@teste.local", status:"ativo", parceria:true}
  ];
  const projetos = [
    {id:"p1", cliente_id:"c1", nome:"Projeto Alpha", status:"em_andamento", numero_contrato:"ALPHA-001", parceria:false},
    {id:"p2", cliente_id:"c2", nome:"Projeto Beta", status:"em_andamento", numero_contrato:"", parceria:true}
  ];
  const documentos = [
    {id:"d1", cliente_id:"c1", projeto_id:"p1", nome:"Projeto Executivo Alpha", titulo:"Projeto Executivo Alpha", tipo:"projeto", nome_original:"Projeto_Executivo.pdf", arquivo:"c1/p1/projeto-executivo.pdf", autoral:true},
    {id:"d2", cliente_id:"c2", projeto_id:"p2", nome:"ART Beta", titulo:"ART Beta", tipo:"art", nome_original:"ART_Beta.pdf", arquivo:"c2/p2/art.pdf", autoral:false}
  ];
  const fotos = [
    {id:"f1", cliente_id:"c1", projeto_id:"p1", nome:"Fachada Alpha", arquivo:"c1/p1/fachada.webp"},
    {id:"f2", cliente_id:"c2", projeto_id:"p2", nome:"Interior Beta", arquivo:"c2/p2/interior.webp"}
  ];
  const biblioteca = [
    {id:"b1", cliente_id:"c1", projeto_id:"p1", nome:"Guia de Estilos Alpha", categoria:"guia_estilos", tipo:"application/pdf", arquivo:"c1/p1/guia_estilos/guia.pdf", tamanho:"1 MB", autoral:true}
  ];
  const cronograma = [
    {id:"cr1",cliente_id:"c1",projeto_id:"p1",nome:"Fundação",status:"Em andamento",ordem:1,peso_percentual:30,percentual_conclusao:50,data_inicio:"2026-08-01",data_fim:"2026-08-20"},
    {id:"cr2",cliente_id:"c2",projeto_id:"p2",nome:"Alvenaria",status:"Pendente",ordem:1,peso_percentual:20,percentual_conclusao:0,data_inicio:"2026-09-01",data_fim:"2026-09-20"}
  ];
  let configuracoes = {
    id:"cfg1",
    nome_empresa:"Camila Martins Engenharia",
    cnpj:"00.000.000/0001-00",
    crea:"CREA-TESTE",
    email:"contato@teste.local",
    telefone:"(21) 0000-0000",
    endereco:"Rua Teste",
    cidade:"Rio de Janeiro",
    estado:"RJ",
    descricao:"Configuração QA",
    tema:"escuro",
    cor_principal:"#b89a63",
    notificacoes:true
  };

  const samples = {clientes,projetos,documentos,fotos,biblioteca,cronograma};

  function result(name,args){
    const lower=name.toLowerCase();

    if(lower === "dbbuscarconfiguracoes") return {...configuracoes};
    if(lower === "dbsalvarconfiguracoes"){
      configuracoes = {...configuracoes,...(args[0]||{})};
      return [{...configuracoes}];
    }

    if(lower.includes("clientes")) return samples.clientes;
    if(lower.includes("projetos")) return samples.projetos;
    if(lower.includes("documentos")) return samples.documentos;
    if(lower.includes("fotos")) return samples.fotos;
    if(lower.includes("biblioteca")) return samples.biblioteca;
    if(lower.includes("cronograma")) return samples.cronograma;
    if(lower.includes("agenda")) return [];
    if(lower.includes("solicitacoes")) return [];
    if(lower.includes("financeiro")) return [
      {id:"fi1",projeto_id:"p1",descricao:"Parcela Alpha",tipo:"entrada",valor:2000,data:"2026-08-01",status:"pago",categoria:"parcelas",data_pagamento:"2026-08-01"},
      {id:"fi2",projeto_id:"p1",descricao:"Parcela futura",tipo:"entrada",valor:1500,data:"2026-09-10",data_vencimento:"2026-09-10",status:"pendente",categoria:"parcelas"},
      {id:"fi3",projeto_id:"p1",descricao:"Fornecedor",tipo:"saida",valor:500,data:"2026-09-12",data_vencimento:"2026-09-12",status:"previsto",categoria:"fornecedores"}
    ];
    if(lower.includes("porid") || lower.includes("detalhe")) return {...clientes[0],...projetos[0]};
    if(lower.includes("criar") || lower.includes("editar")) return {...(args[0]||{}), id:(args[0]||{}).id||"mock-id"};
    if(lower.includes("excluir") || lower.includes("remover")) return true;
    if(lower.includes("notificar")) return {enviado:true};
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
    documentos:[{id:"d1", cliente_id:"c1", projeto_id:"p1", nome:"Documento Teste", titulo:"Documento Teste", tipo:"projeto", nome_original:"teste.pdf", arquivo:"c1/p1/teste.pdf", autoral:true}],
    fotos:[{id:"f1", cliente_id:"c1", projeto_id:"p1", nome:"Foto Teste", arquivo:"teste.webp"}],
    biblioteca:[{id:"b1", cliente_id:"c1", projeto_id:"p1", nome:"Arquivo Teste", tipo:"guia_estilos", arquivo:"c1/p1/guia.pdf", autoral:true}],
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
      signUp: async(payload)=>{
        window.__SIGNUP_CALL__=payload;
        return {data:{session:null,user},error:null};
      },
      resetPasswordForEmail: async(email,options)=>{
        window.__RECOVERY_CALL__={email,options};
        return {data:{},error:null};
      },
      updateUser: async(payload)=>{
        window.__UPDATE_USER_CALL__=payload;
        return {data:{user:{...user}},error:null};
      },
      signOut: async()=>({error:null}),
      onAuthStateChange: (callback)=>{
        window.__AUTH_CHANGE_CALLBACK__=callback;
        return {data:{subscription:{unsubscribe(){}}}};
      }
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

  page.__workerCalls = [];
  await page.route("https://cme-public-media.eng-martins-camila.workers.dev/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    page.__workerCalls.push({method,url:url.pathname + url.search});

    if (url.pathname === "/health") {
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({ok:true,service:"cme-public-media",storage:"cloudflare-r2",catalog:"github"})
      });
    }

    if (url.pathname === "/api/manifest" && method === "GET") {
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({
          projetos:[
            {
              slug:"qa-projeto",
              nome:"Projeto QA",
              categoria:"Residencial",
              descricao:"Projeto para teste",
              ativo:true,
              imagens:[
                {
                  src:"https://cme-public-media.eng-martins-camila.workers.dev/media/portfolio/qa-projeto/imagem/existente.webp",
                  storagePath:"portfolio/qa-projeto/imagem/existente.webp",
                  alt:"Imagem existente",
                  ativo:true
                }
              ],
              videos:[]
            }
          ]
        })
      });
    }

    if (url.pathname === "/api/upload" && method === "PUT") {
      const key = url.searchParams.get("key") || "";
      return route.fulfill({
        status:201,
        contentType:"application/json",
        body:JSON.stringify({
          ok:true,
          key,
          size:Number(request.headers()["content-length"] || 100),
          url:"https://cme-public-media.eng-martins-camila.workers.dev/media/" + key.split("/").map(encodeURIComponent).join("/")
        })
      });
    }

    if (url.pathname === "/api/manifest" && method === "PUT") {
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({ok:true,changed:true,commitSha:"qa-commit"})
      });
    }

    if (url.pathname === "/api/delete-batch" && method === "POST") {
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({ok:true,deleted:1,commitSha:"qa-delete",rollbackUsed:false})
      });
    }

    if (url.pathname === "/api/object" && method === "DELETE") {
      return route.fulfill({
        status:200,
        contentType:"application/json",
        body:JSON.stringify({ok:true,deleted:true})
      });
    }

    return route.fulfill({
      status:404,
      contentType:"application/json",
      body:JSON.stringify({ok:false,error:"mock route not found"})
    });
  });

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
  assert(menuLinks >= 11, `${file}: menu lateral incompleto (${menuLinks} links)`);

  const conteudoLinks = await page.locator('a.menu-item[href="protecao-pdf-admin.html"]').count();
  assert(
    conteudoLinks === 1,
    `${file}: "Conteúdo do site" deve aparecer exatamente uma vez no menu (encontrado: ${conteudoLinks})`
  );

  const paginaAtual = file.toLowerCase();
  const ativo = await page.locator("a.menu-item.ativo").evaluateAll(links =>
    links.map(link => (link.getAttribute("href") || "").split("?")[0].toLowerCase())
  );
  assert(
    ativo.length === 1 && ativo[0] === paginaAtual,
    `${file}: item ativo do menu inconsistente: ${ativo.join(", ")}`
  );

  await page.close();
}

// Critérios estruturais: Documentos e Cronograma devem ser pastas fechadas por cliente.
for (const [file,container] of [
  ["documentos.html","#listaDocumentos"],
  ["cronograma.html","#listaCronograma"]
]) {
  const page = await loadPage(context,file);
  await page.waitForTimeout(350);

  const pastas = page.locator(`${container} details.cme-pasta-cliente`);
  const quantidade = await pastas.count();

  assert(
    quantidade === 2,
    `${file}: esperado 2 pastas de clientes, encontrado ${quantidade}`
  );

  const abertas = await pastas.evaluateAll(items => items.filter(item => item.open).length);
  assert(
    abertas === 0,
    `${file}: as pastas devem iniciar fechadas; ${abertas} vieram abertas`
  );

  const textos = await pastas.locator("summary").allTextContents();
  assert(
    textos.some(t => /Cliente Alpha/i.test(t)) && textos.some(t => /Cliente Beta/i.test(t)),
    `${file}: nomes dos clientes não aparecem corretamente nas pastas: ${textos.join(" | ")}`
  );

  await page.close();
}

// Fotos: álbuns padronizados -> grade -> visualizador estilo galeria.
{
  const page = await loadPage(context,"fotos.html");
  await page.waitForTimeout(350);

  const albuns = page.locator("#galeriaFotos .foto-album-card");
  assert(
    await albuns.count() === 2,
    `fotos.html: esperado 2 álbuns de cliente/projeto, encontrado ${await albuns.count()}`
  );

  const badges = page.locator("#galeriaFotos .foto-album-card .foto-album-quantidade");
  assert(
    await badges.count() === 2,
    `fotos.html: cada álbum deve ter exatamente um badge interno; encontrados ${await badges.count()}`
  );

  const badgesFora = page.locator("#galeriaFotos > .foto-album-quantidade");
  assert(
    await badgesFora.count() === 0,
    "fotos.html: existe quantitativo solto fora do card do álbum"
  );

  const textos = await albuns.allTextContents();
  assert(
    textos.some(t => /Cliente Alpha/i.test(t)) && textos.some(t => /Cliente Beta/i.test(t)),
    `fotos.html: nomes dos clientes não aparecem nos álbuns: ${textos.join(" | ")}`
  );

  await albuns.first().click();
  await page.waitForTimeout(80);

  assert(
    await page.locator("#albumFotos").isVisible(),
    "fotos.html: clicar no álbum não abriu a visualização interna"
  );
  assert(
    await page.locator("#galeriaFotos").isHidden(),
    "fotos.html: lista de álbuns permaneceu visível ao abrir um álbum"
  );

  const miniaturas = page.locator("#albumGrade .foto-miniatura-card");
  assert(
    await miniaturas.count() === 1,
    `fotos.html: álbum Alpha deveria ter 1 miniatura, exibiu ${await miniaturas.count()}`
  );

  await page.locator("#albumGrade [data-acao-foto='visualizar']").first().click();
  await page.waitForTimeout(80);

  const viewer = page.locator("#visualizadorFoto");
  assert(await viewer.isVisible(), "fotos.html: clicar na miniatura não abriu o visualizador");
  assert(
    (await page.locator("#viewerContador").textContent() || "").trim() === "1 / 1",
    `fotos.html: contador do visualizador incorreto: ${await page.locator("#viewerContador").textContent()}`
  );

  await page.locator("[data-acao-foto='viewer-fechar']").click();
  assert(await viewer.isHidden(), "fotos.html: visualizador não fechou");

  await page.locator("[data-acao-foto='voltar-albuns']").click();
  assert(await page.locator("#galeriaFotos").isVisible(), "fotos.html: voltar não retornou aos álbuns");

  await responsive(page,"fotos.html álbuns e visualizador");
  await page.close();
}

// Dashboard: Biblioteca deve contar pastas com conteúdo, sem duplicar arquivos.
{
  const page = await loadPage(context,"admin.html");
  const total = (await page.locator("#totalBiblioteca").textContent() || "").trim();
  assert(total === "5", `admin.html: contador Biblioteca deveria representar 5 pastas e exibiu "${total}"`);
  await page.close();
}

// Contratos: a interface deve permitir selecionar vários ORCs.
{
  const page = await loadPage(context, "orcamentos-contratos.html");
  await page.locator('[data-doc-tab="contrato"]').click();
  await page.waitForTimeout(120);

  const select = page.locator("#contractQuoteSelect");
  assert(await select.count() === 1, "orcamentos-contratos.html: seletor de ORCs ausente");
  if (await select.count()) {
    assert(
      await select.getAttribute("multiple") !== null,
      "orcamentos-contratos.html: seletor ainda aceita somente um ORC"
    );
    const label = (await page.locator('label[for="contractQuoteSelect"]').textContent() || "").trim();
    assert(/um ou mais orçamentos/i.test(label), `orcamentos-contratos.html: rótulo do vínculo múltiplo inesperado: ${label}`);
  }

  await responsive(page, "orcamentos-contratos.html com múltiplos ORCs");
  await page.close();
}

// Frase do dia: somente português atual e conteúdo editorial revisado.
{
  const page = await loadPage(context, "admin.html");
  await page.waitForTimeout(250);
  const frase = (await page.locator("#cmeFraseTexto").textContent().catch(() => "")) || "";
  const autor = (await page.locator("#cmeFraseAutor").textContent().catch(() => "")) || "";

  assert(Boolean(frase.trim()), "admin.html: Frase do dia não foi carregada");
  assert(!/[_*`<>]/.test(frase), `admin.html: Frase do dia contém marcação indevida: ${frase}`);
  assert(
    !/\b(?:n['’]um|n['’]uma|d['’]um|d['’]uma|d['’]elle|d['’]ella|scenas?|polycarpo|yaya|pharmacia|acceitar|ahi)\b/i.test(frase),
    `admin.html: Frase do dia contém grafia antiga: ${frase}`
  );
  assert(/Editorial Camila Martins Engenharia/i.test(autor), `admin.html: autoria editorial inesperada: ${autor}`);
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
    fields:{documentoNome:"Projeto Executivo QA",documentoCliente:"c1",documentoProjeto:"p1",documentoAutoral:true,documentoArquivo:["Projeto_Executivo_QA.pdf"]}
  },
  {
    file:"biblioteca.html", open:"novoArquivo", form:"formArquivo", expected:"dbSalvarArquivoBiblioteca",
    fields:{arquivoNome:"Guia de Estilos QA",arquivoCliente:"c1",arquivoProjeto:"p1",arquivoAutoral:true,arquivoUpload:["Guia_Estilos_QA.pdf"]}
  },
  {
    file:"fotos.html", open:"novaFoto", form:"formFoto", expected:"dbCriarFoto",
    fields:{fotoCliente:"c1",fotoProjeto:"p1",fotoTitulo:"Foto QA",arquivoFoto:["foto-qa.webp"]}
  },
  {
    file:"financeiro.html", open:"novoLancamento", form:"formFinanceiro", expected:"dbCriarLancamentoFinanceiro",
    fields:{financeiroDescricao:"Lançamento QA",financeiroValor:"100",financeiroData:"2026-08-29",financeiroStatus:"pago",financeiroCategoria:"honorarios",financeiroVencimento:"2026-08-29",financeiroFormaPagamento:"pix"}
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

    if (teste.file === "projetos.html") {
      assert(
        dados.numero_contrato == null || dados.numero_contrato === "",
        "projetos.html: parceria sem contrato não foi aceita"
      );
      assert(
        dados.numero_orcamento == null || dados.numero_orcamento === "",
        "projetos.html: parceria sem orçamento não foi aceita"
      );
    }
  }

  if (teste.file === "documentos.html" || teste.file === "biblioteca.html") {
    const chamada = calls.find(call => call.name === teste.expected);
    const dados = chamada?.args?.[0] || {};
    assert(dados.autoral === true, `${teste.file}: marcação autoral não chegou ao payload`);
  }

  if (teste.file === "financeiro.html") {
    const chamada = calls.find(call => call.name === teste.expected);
    const dados = chamada?.args?.[0] || {};
    assert(dados.status === "pago", "financeiro.html: situação não chegou ao payload");
    assert(dados.categoria === "honorarios", "financeiro.html: categoria não chegou ao payload");
    assert(dados.forma_pagamento === "pix", "financeiro.html: forma de pagamento não chegou ao payload");
  }

  assert(
    (page.__cmePageErrors || []).length === 0,
    `${teste.file}: erro JS após salvar: ${(page.__cmePageErrors || []).join(" | ")}`
  );

  await page.close();
}

// Biblioteca Admin: acervo consolidado e somente categorias com conteúdo.
{
  const page = await loadPage(context,"biblioteca.html");
  await page.waitForTimeout(850);

  const pastasCliente = page.locator("#listaBiblioteca > details.cme-pasta-cliente");
  assert(
    await pastasCliente.count() === 2,
    `biblioteca.html: esperado 2 pastas de clientes, encontrado ${await pastasCliente.count()}`
  );

  const categorias = await page.locator("#listaBiblioteca .cm-category-folder")
    .evaluateAll(items => items.map(item => item.dataset.categoria));

  for (const esperada of ["projeto","art","guia_estilos","imagens"]) {
    assert(
      categorias.includes(esperada),
      `biblioteca.html: categoria existente "${esperada}" não apareceu. Renderizadas: ${categorias.join(", ")}`
    );
  }

  for (const vazia of ["contrato","orcamento","guia_obras","laudo","memorial","norma","modelo","outros"]) {
    assert(
      !categorias.includes(vazia),
      `biblioteca.html: categoria vazia "${vazia}" apareceu indevidamente`
    );
  }

  const categoriasSemItens = await page.locator("#listaBiblioteca .cm-category-folder").evaluateAll(items =>
    items.filter(item => item.querySelectorAll(".cm-file-card").length === 0)
      .map(item => item.dataset.categoria)
  );
  assert(
    categoriasSemItens.length === 0,
    `biblioteca.html: existem pastas vazias: ${categoriasSemItens.join(", ")}`
  );

  const totalCards = await page.locator("#listaBiblioteca .cm-file-card").count();
  assert(totalCards === 5, `biblioteca.html: acervo consolidado deveria ter 5 itens, exibiu ${totalCards}`);

  await page.close();
}

// Configurações: carregar, aplicar, salvar/confirmar, backup, notificações e cache.
{
  const page = await loadPage(context, "configuracoes.html");

  assert(
    await page.locator("#empresaNome").inputValue() === "Camila Martins Engenharia",
    "configuracoes.html: dados salvos não foram carregados"
  );

  await page.locator("#empresaNome").fill("Camila Martins Engenharia QA");
  await page.locator("#sistemaTema").selectOption("claro");
  await page.locator("#sistemaCorPrincipal").fill("#123456");
  await page.locator("#sistemaNotificacoes").selectOption("inativo");

  // Os campos possuem transição de cor; aguarda o estado visual final.
  await page.waitForTimeout(500);

  const temaAplicado = await page.evaluate(() => document.documentElement.dataset.adminTheme);
  const corAplicada = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--dourado").trim()
  );

  const aparenciaCamposClaros = await page.locator("#empresaNome, #empresaCnpj").evaluateAll(elements =>
    elements.map(el => {
      const style = getComputedStyle(el);
      let autofill = false;
      try { autofill = el.matches(":-webkit-autofill"); } catch {}
      return {
        id: el.id,
        background: style.backgroundColor,
        color: style.color,
        textFill: style.webkitTextFillColor,
        boxShadow: style.boxShadow,
        opacity: style.opacity,
        autofill
      };
    })
  );

  assert(temaAplicado === "claro", `configuracoes.html: tema claro não foi aplicado (${temaAplicado})`);
  assert(corAplicada.toLowerCase() === "#123456", `configuracoes.html: cor não foi aplicada (${corAplicada})`);

  for (const campo of aparenciaCamposClaros) {
    const fundoBranco =
      campo.background === "rgb(255, 255, 255)" ||
      (/inset/i.test(campo.boxShadow) && /rgb\(255, 255, 255\)/i.test(campo.boxShadow));

    const textoEscuro =
      ["rgb(27, 36, 48)", "rgb(17, 24, 39)"].includes(campo.textFill) ||
      ["rgb(27, 36, 48)", "rgb(17, 24, 39)"].includes(campo.color);

    assert(
      fundoBranco,
      `configuracoes.html: #${campo.id} não tem fundo visual claro. bg=${campo.background}; shadow=${campo.boxShadow}; autofill=${campo.autofill}`
    );
    assert(
      textoEscuro,
      `configuracoes.html: #${campo.id} não tem texto escuro legível. color=${campo.color}; textFill=${campo.textFill}; autofill=${campo.autofill}`
    );
    assert(
      campo.opacity === "1",
      `configuracoes.html: #${campo.id} está com opacidade inesperada: ${campo.opacity}`
    );
  }

  await page.locator("#formConfiguracoes").evaluate(el => el.requestSubmit());

  await page.waitForFunction(
    () => (window.__DB_CALLS__ || []).some(call => call.name === "dbSalvarConfiguracoes"),
    null,
    {timeout:3500}
  ).catch(()=>{});

  const calls = await page.evaluate(() => window.__DB_CALLS__ || []);
  const salvar = calls.find(call => call.name === "dbSalvarConfiguracoes");
  const dados = salvar?.args?.[0] || {};

  assert(dados.nome_empresa === "Camila Martins Engenharia QA", "Configurações: nome não chegou ao salvamento");
  assert(dados.tema === "claro", "Configurações: tema não chegou ao salvamento");
  assert(dados.cor_principal === "#123456", "Configurações: cor não chegou ao salvamento");
  assert(dados.notificacoes === false, "Configurações: notificações inativas não chegaram ao salvamento");

  const status = (await page.locator("#statusConfiguracoes").textContent().catch(()=>"")) || "";
  assert(/confirmadas no banco/i.test(status), `Configurações: salvamento não foi confirmado: ${status}`);

  const notificacao = await page.evaluate(async () =>
    typeof window.dbNotificarAtualizacao === "function"
      ? await window.dbNotificarAtualizacao({tipo:"qa"})
      : null
  );
  assert(
    notificacao?.enviado === false && /desativadas/i.test(notificacao?.motivo || ""),
    "Configurações: opção de notificações desativadas não está sendo respeitada"
  );

  const downloadPromise = page.waitForEvent("download",{timeout:4000}).catch(()=>null);
  await page.locator("#gerarBackup").click();
  const download = await downloadPromise;
  assert(Boolean(download), "Configurações: Gerar Backup não iniciou download");

  await page.evaluate(() => {
    sessionStorage.setItem("qa-cache","1");
    localStorage.setItem("cme_cache_qa","1");
  });
  await page.locator("#limparCache").click();
  await page.waitForTimeout(180);

  const cache = await page.evaluate(() => ({
    session: sessionStorage.getItem("qa-cache"),
    local: localStorage.getItem("cme_cache_qa")
  }));
  assert(cache.session === null && cache.local === null, "Configurações: Limpar Cache não limpou o cache local");

  assert(
    (page.__cmePageErrors || []).length === 0,
    `configuracoes.html: erro JS: ${(page.__cmePageErrors || []).join(" | ")}`
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

// Classificação automática: padrões reais do acervo legado e opção manual Imagens.
{
  const page = await loadPage(context,"documentos.html");

  const resultado = await page.evaluate(() => ({
    obra: window.CMEClassificarDocumento?.("CM_Guia_17_Eletrica_Eletrodutos_Circuitos_Protecoes.pdf"),
    estilos: window.CMEClassificarDocumento?.("01_Guia_Estilos_de_Interiores_Camila_Martins.pdf"),
    art: window.CMEClassificarDocumento?.("ART_Execucao_Obra.pdf"),
    laudo: window.CMEClassificarDocumento?.("Laudo_Vistoria_Predial.pdf")
  }));

  assert(resultado.obra === "guia_obras", `Classificador: guia técnico deveria ser guia_obras, retornou ${resultado.obra}`);
  assert(resultado.estilos === "guia_estilos", `Classificador: guia de interiores deveria ser guia_estilos, retornou ${resultado.estilos}`);
  assert(resultado.art === "art", `Classificador: ART deveria ser art, retornou ${resultado.art}`);
  assert(resultado.laudo === "laudo", `Classificador: Laudo deveria ser laudo, retornou ${resultado.laudo}`);

  await page.close();
}

{
  const page = await loadPage(context,"biblioteca.html");

  const resultado = await page.evaluate(() => ({
    obra: window.CMEClassificarBiblioteca?.(
      "CM_Guia_13_Impermeabilizacao_Banheiros_Varandas_Lajes.pdf",
      "outros"
    ),
    estilos: window.CMEClassificarBiblioteca?.(
      "15_Guia_Complementar_de_Tecidos_Camila_Martins.pdf",
      "outros"
    )
  }));

  assert(resultado.obra === "guia_obras", `Biblioteca: legado técnico deveria ser guia_obras, retornou ${resultado.obra}`);
  assert(resultado.estilos === "guia_estilos", `Biblioteca: legado de tecidos deveria ser guia_estilos, retornou ${resultado.estilos}`);

  const imagensOption = await page.locator('#arquivoCategoria option[value="imagens"]').count();
  assert(imagensOption === 1, "biblioteca.html: opção manual Imagens não está disponível");

  await page.close();
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

// Biblioteca Cliente: Documentos + Fotos + Biblioteca do contrato, sem pastas vazias.
{
  const page = await loadPage(context,"biblioteca-cliente.html");
  await page.waitForTimeout(1000);

  const categorias = await page.locator("#areaContent .cm-category-folder")
    .evaluateAll(items => items.map(item => item.dataset.categoria));

  for (const esperada of ["projeto","guia_estilos","imagens"]) {
    assert(
      categorias.includes(esperada),
      `biblioteca-cliente.html: categoria "${esperada}" não apareceu. Renderizadas: ${categorias.join(", ")}`
    );
  }

  for (const vazia of ["art","contrato","orcamento","guia_obras","laudo","memorial","norma","modelo","outros"]) {
    assert(
      !categorias.includes(vazia),
      `biblioteca-cliente.html: categoria vazia "${vazia}" apareceu`
    );
  }

  const total = await page.locator("#areaContent .cm-file-card").count();
  assert(total === 3, `biblioteca-cliente.html: deveria consolidar 3 itens, exibiu ${total}`);

  await page.close();
}

// Ponte R2/GitHub: upload, manifesto e exclusão transacional.
{
  const page = await loadPage(context, "protecao-pdf-admin.html");
  await page.waitForTimeout(250);

  const bridgeReady = await page.evaluate(() =>
    Boolean(window.CME_PORTFOLIO_R2_BRIDGE) &&
    window.CME_PORTFOLIO_R2_BRIDGE.bucket === "projetos"
  );
  assert(bridgeReady, "Conteúdo do site: ponte R2/GitHub não foi carregada");

  const publicUrl = await page.evaluate(() =>
    window.supabaseClient.storage
      .from("projetos")
      .getPublicUrl("portfolio/qa-projeto/imagem/teste.webp")
      .data.publicUrl
  );
  assert(
    publicUrl.includes("cme-public-media.eng-martins-camila.workers.dev/media/portfolio/"),
    `Conteúdo do site: URL pública não aponta para o Worker: ${publicUrl}`
  );

  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 8, 8);

    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("canvas test blob failed")), "image/png")
    );
    const file = new File([blob], "qa.png", {type:"image/png"});

    const bucket = window.supabaseClient.storage.from("projetos");
    const upload = await bucket.upload("portfolio/qa-projeto/imagem/qa.png", file, {
      contentType:"image/png",
      upsert:true
    });

    const manifest = new Blob([
      JSON.stringify({
        projetos:[
          {
            slug:"qa-projeto",
            nome:"Projeto QA",
            imagens:[
              {
                src:"https://cme-public-media.eng-martins-camila.workers.dev/media/portfolio/qa-projeto/imagem/qa.png",
                storagePath:"portfolio/qa-projeto/imagem/qa.png",
                alt:"QA"
              }
            ],
            videos:[]
          }
        ]
      })
    ], {type:"application/json"});

    const saved = await bucket.upload("portfolio/galeria.json", manifest, {
      contentType:"application/json",
      upsert:true
    });

    await bucket.remove(["portfolio/qa-projeto/imagem/qa.png"]);

    const emptyManifest = new Blob([
      JSON.stringify({projetos:[{slug:"qa-projeto",nome:"Projeto QA",imagens:[],videos:[]}]})
    ], {type:"application/json"});

    const deleted = await bucket.upload("portfolio/galeria.json", emptyManifest, {
      contentType:"application/json",
      upsert:true
    });

    return {
      uploadError: upload.error?.message || null,
      saveError: saved.error?.message || null,
      deleteError: deleted.error?.message || null
    };
  });

  assert(!result.uploadError, `Conteúdo do site: upload pela ponte falhou: ${result.uploadError}`);
  assert(!result.saveError, `Conteúdo do site: atualização do GitHub falhou: ${result.saveError}`);
  assert(!result.deleteError, `Conteúdo do site: exclusão transacional falhou: ${result.deleteError}`);

  const calls = page.__workerCalls || [];
  assert(
    calls.some(x => x.method === "PUT" && x.url.startsWith("/api/upload?key=")),
    "Conteúdo do site: upload não chamou /api/upload"
  );
  assert(
    calls.some(x => x.method === "PUT" && x.url === "/api/manifest"),
    "Conteúdo do site: catálogo não chamou PUT /api/manifest"
  );
  assert(
    calls.some(x => x.method === "POST" && x.url === "/api/delete-batch"),
    "Conteúdo do site: exclusão não chamou /api/delete-batch"
  );

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

// Cartão virtual: mantém Site oficial e remove o link redundante do rodapé.
{
  const page = await loadPage(context, "contato.html");
  assert(
    await page.locator('.contact-buttons a[href="index.html"]').count() === 1,
    "contato.html: botão Site oficial ausente"
  );
  assert(
    await page.locator(".back-site a").count() === 0,
    "contato.html: cartão virtual ainda exibe Voltar ao site"
  );
  const closing = (await page.locator(".card-closing-message").textContent().catch(()=>"")) || "";
  assert(
    /transforma ideias|pensadas para durar/i.test(closing),
    `contato.html: frase final ausente ou inesperada: ${closing}`
  );
  await responsive(page, "contato.html");
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

    const advice = page.locator("#passwordSecurityAdvice");
    assert(await advice.count() === 1, "login.html: orientação de segurança de senha ausente");
    if (await advice.count()) {
      assert(await advice.isVisible(), "login.html: orientação de segurança não apareceu no Primeiro acesso");
      const adviceText = (await advice.textContent()) || "";
      assert(
        /senha exclusiva/i.test(adviceText) && /e-mail/i.test(adviceText),
        `login.html: orientação de segurança inesperada: ${adviceText}`
      );
    }
  } else {
    failures.push("login.html: botão Primeiro acesso ausente");
  }
  await page.close();
}

// Primeiro acesso: e-mail previamente cadastrado -> signUp -> confirmação por e-mail.
{
  const page = await loadPage(context, "login.html");

  await page.locator("#firstAccess").click();
  await page.locator("#email").fill("cliente.qa@example.com");
  await page.locator("#senha").fill("SenhaNova123!");
  await page.locator("#confirmarSenha").fill("SenhaNova123!");
  await page.locator("#loginForm").evaluate(el => el.requestSubmit());

  await page.waitForTimeout(120);

  const signup = await page.evaluate(() => window.__SIGNUP_CALL__ || null);

  assert(Boolean(signup), "login.html: Primeiro acesso não chamou signUp");
  assert(
    signup?.email === "cliente.qa@example.com",
    "login.html: Primeiro acesso enviou e-mail incorreto"
  );
  assert(
    signup?.password === "SenhaNova123!",
    "login.html: Primeiro acesso enviou senha incorreta"
  );
  assert(
    /\/login\.html$/i.test(
      new URL(signup?.options?.emailRedirectTo || "https://invalid/").pathname
    ),
    `login.html: emailRedirectTo do Primeiro acesso está incorreto: ${signup?.options?.emailRedirectTo || "ausente"}`
  );

  const mensagem = (await page.locator("#formMessage").textContent().catch(()=>"")) || "";
  assert(
    /acesso criado|confirmação/i.test(mensagem),
    `login.html: mensagem após Primeiro acesso inesperada: ${mensagem}`
  );

  await page.close();
}

// Primeiro acesso deve barrar senhas divergentes antes de chamar o Supabase.
{
  const page = await loadPage(context, "login.html");

  await page.locator("#firstAccess").click();
  await page.locator("#email").fill("cliente.qa@example.com");
  await page.locator("#senha").fill("SenhaNova123!");
  await page.locator("#confirmarSenha").fill("OutraSenha123!");
  await page.locator("#loginForm").evaluate(el => el.requestSubmit());

  await page.waitForTimeout(80);

  const signup = await page.evaluate(() => window.__SIGNUP_CALL__ || null);
  const mensagem = (await page.locator("#formMessage").textContent().catch(()=>"")) || "";

  assert(!signup, "login.html: Primeiro acesso chamou signUp mesmo com senhas diferentes");
  assert(
    /não são iguais/i.test(mensagem),
    `login.html: validação de senhas divergentes não apareceu: ${mensagem}`
  );

  await page.close();
}

// Recuperação de senha: login -> /recover -> redefinir senha.
{
  const page = await loadPage(context, "login.html");

  await page.locator("#email").fill("qa-recovery@example.com");
  await page.locator("#forgotPassword").click();
  await page.waitForTimeout(120);

  const recovery = await page.evaluate(() => window.__RECOVERY_CALL__ || null);

  assert(Boolean(recovery), "login.html: Esqueci minha senha não chamou resetPasswordForEmail");
  assert(
    recovery?.email === "qa-recovery@example.com",
    "login.html: recuperação usou e-mail diferente do digitado"
  );
  assert(
    /\/redefinir-senha\.html$/i.test(new URL(recovery?.options?.redirectTo || "https://invalid/").pathname),
    `login.html: redirectTo da recuperação está incorreto: ${recovery?.options?.redirectTo || "ausente"}`
  );

  const mensagem = (await page.locator("#formMessage").textContent().catch(()=>"")) || "";
  assert(
    /link de recuperação/i.test(mensagem),
    `login.html: mensagem de recuperação inesperada: ${mensagem}`
  );

  await page.close();
}

{
  const page = await loadPage(context, "redefinir-senha.html");

  // Simula evento de recuperação aceito pelo Supabase.
  await page.evaluate(() => {
    window.__AUTH_CHANGE_CALLBACK__?.(
      "PASSWORD_RECOVERY",
      { user:{id:"client-test"}, access_token:"recovery-token" }
    );
  });

  await page.waitForTimeout(80);

  await page.locator("#novaSenha").fill("SenhaNova123!");
  await page.locator("#confirmarSenha").fill("SenhaNova123!");
  await page.locator("#formRedefinirSenha").evaluate(el => el.requestSubmit());

  await page.waitForTimeout(150);

  const update = await page.evaluate(() => window.__UPDATE_USER_CALL__ || null);

  assert(Boolean(update), "redefinir-senha.html: formulário não chamou updateUser");
  assert(
    update?.password === "SenhaNova123!",
    "redefinir-senha.html: nova senha não chegou corretamente ao Supabase"
  );

  const mensagem = (await page.locator("#mensagem").textContent().catch(()=>"")) || "";
  assert(
    /senha alterada|senha.*sucesso|alterada com sucesso/i.test(mensagem),
    `redefinir-senha.html: confirmação de troca de senha inesperada: ${mensagem}`
  );

  await page.close();
}

// Parceria: cliente marcado deve preencher automaticamente o novo projeto.
{
  const page = await loadPage(context, "projetos.html");
  await page.locator("#novoProjeto").click();
  await page.locator("#projetoCliente").selectOption("c2");
  await page.waitForTimeout(520);
  assert(await page.locator("#projetoParceria").isChecked(), "projetos.html: parceria do cliente não foi herdada");
  assert(await page.locator("#projetoParceriaHerdada").isVisible(), "projetos.html: aviso de parceria herdada não apareceu");
  await page.close();
}

// Financeiro: indicadores dinâmicos, visão por projeto e novos campos.
{
  const page = await loadPage(context, "financeiro.html");
  await page.waitForTimeout(700);
  const indicadores = await page.locator(".financeiro-indicadores article").count();
  assert(indicadores === 4, `financeiro.html: esperado 4 indicadores, encontrado ${indicadores}`);
  const resumo = (await page.locator("#financeiroResumoProjetos").textContent() || "");
  assert(/Projeto Alpha/i.test(resumo), `financeiro.html: visão por projeto não foi montada: ${resumo}`);
  assert(await page.locator("#financeiroStatus").count() === 1, "financeiro.html: campo Situação ausente");
  assert(await page.locator("#financeiroVencimento").count() === 1, "financeiro.html: campo Vencimento ausente");
  await page.close();
}

// Tema claro: componentes dinâmicos do Admin não podem manter fundo escuro.
{
  const page = await loadPage(context, "biblioteca.html");
  await page.evaluate(() => { document.documentElement.dataset.adminTheme = "claro"; });
  await page.waitForTimeout(100);
  const aparencia = await page.locator("#listaBiblioteca .cm-file-card").first().evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color
  }));
  assert(aparencia.background === "rgb(255, 255, 255)", `biblioteca.html: card permaneceu escuro no tema claro (${aparencia.background})`);
  assert(["rgb(27, 36, 48)", "rgb(17, 24, 39)"].includes(aparencia.color), `biblioteca.html: texto sem contraste no tema claro (${aparencia.color})`);
  await page.close();
}

// Portal do cliente: seletor de tema e identificação de conteúdo autoral.
{
  const page = await loadPage(context, "documentos-cliente.html");
  await page.waitForTimeout(1500);
  const botaoTema = page.locator("#portalThemeToggle");
  assert(await botaoTema.count() === 1, "documentos-cliente.html: seletor de tema ausente");
  await botaoTema.click();
  assert(await page.evaluate(() => document.documentElement.dataset.portalTheme) === "claro", "documentos-cliente.html: tema claro não foi ativado");
  const painel = await page.locator("#areaContent").evaluate(el => getComputedStyle(el).backgroundColor);
  assert(painel === "rgb(255, 255, 255)", `documentos-cliente.html: painel permaneceu escuro (${painel})`);
  assert(await page.locator(".cme-authorship-badge").count() >= 1, "documentos-cliente.html: selo de cópia autoral rastreável ausente");
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error("\nFALHAS DE SMOKE TEST:");
  failures.forEach((failure,index)=>console.error(`${index+1}. ${failure}`));
  process.exit(1);
}
console.log("AUDITORIA DE ACEITAÇÃO APROVADA: estrutura, Configurações, pastas, uploads, segurança, Admin e Cliente.");
