/*
==========================================================
CAMILA MARTINS ENGENHARIA
ADMIN.JS — DASHBOARD ESTÁVEL
==========================================================
*/

document.addEventListener('DOMContentLoaded', () => {
  configurarEventosAdmin();
  garantirAtalhoDocumentalAdmin();
  carregarFraseDoDiaAdmin();
  iniciarDashboard();
});

let carregandoDashboard = false;

function versaoDoScriptAdmin() {
  const script = Array.from(document.scripts).find(item => /\/js\/admin\.js(?:\?|$)/.test(item.src));
  return script ? new URL(script.src, location.href).searchParams.get('v') : '';
}

function carregarFraseDoDiaAdmin() {
  if (window.__CME_FRASE_DO_DIA__ || document.getElementById('cmeFraseDoDiaScript')) return;
  const script = document.createElement('script');
  const versao = versaoDoScriptAdmin() || '20260903-4';
  script.id = 'cmeFraseDoDiaScript';
  script.src = `js/frase-do-dia.js?v=${encodeURIComponent(versao)}`;
  script.defer = true;
  document.head.appendChild(script);
}

function garantirAtalhoDocumentalAdmin() {
  const cards = Array.from(document.querySelectorAll('.card-lateral'));
  const card = cards.find(item => item.querySelector('h2')?.textContent?.trim() === 'Ações Rápidas');
  if (!card) return;

  for (const id of ['abrirComercial', 'abrirContratuais', 'abrirArquivoDocumental', 'abrirCentralDocumentos', 'atalhosGerarDocumentos', 'abrirContratosGerais']) {
    document.getElementById(id)?.remove();
  }

  const botao = document.createElement('button');
  botao.id = 'abrirContratosGerais';
  botao.type = 'button';
  botao.title = 'Abrir orçamento, contrato e documentos complementares';
  botao.innerHTML = '<i class="fa-solid fa-file-signature"></i><span>Contratos gerais</span>';
  botao.addEventListener('click', () => { window.location.href = 'orcamentos-contratos.html'; });
  card.appendChild(botao);
}

async function buscarSeguro(rotulo, funcao) {
  if (typeof funcao !== 'function') {
    console.warn(`Dashboard: consulta de ${rotulo} indisponível.`);
    return [];
  }

  try {
    const resultado = await funcao();
    return Array.isArray(resultado) ? resultado : [];
  } catch (erro) {
    console.warn(`Dashboard: não foi possível carregar ${rotulo}.`, erro);
    return [];
  }
}

async function iniciarDashboard() {
  if (carregandoDashboard) return;
  carregandoDashboard = true;

  try {
    const [clientes, projetos, documentos, fotos, biblioteca] = await Promise.all([
      buscarSeguro('clientes', window.dbBuscarClientes),
      buscarSeguro('projetos', window.dbBuscarProjetos),
      buscarSeguro('documentos', window.dbBuscarDocumentos),
      buscarSeguro('fotos', window.dbBuscarFotos),
      buscarSeguro('biblioteca', window.dbBuscarBiblioteca)
    ]);

    atualizarNumeroAdmin('totalClientes', clientes.length);
    atualizarNumeroAdmin('totalProjetos', projetos.length);
    atualizarNumeroAdmin('totalDocumentos', documentos.length);
    atualizarNumeroAdmin('totalFotos', fotos.length);
    atualizarPastasBibliotecaAdmin(biblioteca, documentos, fotos);

    renderizarClientesAdmin(clientes);
    renderizarProjetosAdmin(projetos);
    renderizarDocumentosAdmin(documentos);
    await carregarArmazenamentoAdmin();

    const atividades = document.getElementById('atividadeRecentes');
    if (atividades) atividades.innerHTML = '<div class="atividade">Dashboard atualizado.</div>';
  } catch (erro) {
    console.error('Erro ao carregar dashboard:', erro);
  } finally {
    carregandoDashboard = false;
    ocultarLoadingAdmin();
  }
}

function ocultarLoadingAdmin() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
    loading.style.pointerEvents = 'none';
    loading.setAttribute('aria-hidden', 'true');
  }
}

function configurarEventosAdmin() {
  if (window.__CME_ADMIN_EVENTOS__) return;
  window.__CME_ADMIN_EVENTOS__ = true;

  const navegacao = {
    abrirClientes: 'clientes.html',
    abrirProjetos: 'projetos.html',
    abrirDocumentos: 'documentos.html',
    abrirBiblioteca: 'biblioteca.html',
    abrirFotos: 'fotos.html',
    abrirFinanceiro: 'financeiro.html',
    abrirAgenda: 'agenda.html',
    abrirConfiguracoes: 'configuracoes.html',
    abrirCentralDocumentos: 'orcamentos-contratos.html',
    abrirContratosGerais: 'orcamentos-contratos.html',
    novoProjeto: 'projetos.html',
    verTodosProjetos: 'projetos.html',
    verTodosDocumentos: 'documentos.html'
  };

  Object.entries(navegacao).forEach(([id, destino]) => {
    document.getElementById(id)?.addEventListener('click', () => { window.location.href = destino; });
  });

  const pesquisar = document.getElementById('btnPesquisarCliente');
  const campo = document.getElementById('pesquisaCliente');
  pesquisar?.addEventListener('click', pesquisarClientesAdmin);
  campo?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pesquisarClientesAdmin();
    }
  });
}

function renderizarClientesAdmin(clientes) {
  const lista = document.getElementById('listaClientes');
  if (!lista) return;

  if (!clientes.length) {
    lista.innerHTML = '<div class="estado-vazio">Nenhum cliente cadastrado.</div>';
    return;
  }

  lista.innerHTML = clientes.map(cliente =>
    `<div class="item-dashboard"><strong>${escaparAdmin(cliente.nome || 'Cliente')}</strong><span>${escaparAdmin(cliente.email || '')}</span></div>`
  ).join('');
}

async function pesquisarClientesAdmin() {
  const termo = (document.getElementById('pesquisaCliente')?.value || '').trim().toLowerCase();
  const clientes = await buscarSeguro('clientes', window.dbBuscarClientes);
  const filtrados = termo
    ? clientes.filter(cliente =>
        String(cliente.nome || '').toLowerCase().includes(termo) ||
        String(cliente.email || '').toLowerCase().includes(termo)
      )
    : clientes;
  renderizarClientesAdmin(filtrados);
}

function renderizarProjetosAdmin(projetos) {
  const lista = document.getElementById('listaProjetos');
  if (!lista) return;
  const recentes = projetos.slice(0, 6);
  lista.innerHTML = recentes.length
    ? recentes.map(projeto => `<div class="item-dashboard"><strong>${escaparAdmin(projeto.nome || 'Projeto')}</strong></div>`).join('')
    : '<div class="estado-vazio">Nenhum projeto cadastrado.</div>';
}

function renderizarDocumentosAdmin(documentos) {
  const lista = document.getElementById('listaDocumentos');
  if (!lista) return;
  const recentes = documentos.slice(0, 6);
  lista.innerHTML = recentes.length
    ? recentes.map(documento =>
        `<div class="item-dashboard"><strong>${escaparAdmin(documento.nome || documento.titulo || 'Documento')}</strong><span>${escaparAdmin(documento.tipo || '')}</span></div>`
      ).join('')
    : '<div class="estado-vazio">Nenhum documento cadastrado.</div>';
}

function normalizarCategoriaAdmin(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoriaPastaAdmin(item, origem) {
  if (origem === 'foto') return 'imagens';

  const informada = normalizarCategoriaAdmin(item.categoria || item.tipo);
  const nome = normalizarCategoriaAdmin(item.nome_original || item.nome || item.titulo || item.arquivo);
  const texto = `${informada} ${nome}`;

  const categorias = [
    ['art', /(^|\s)(art|rrt)(\s|$)|anotacao de responsabilidade|registro de responsabilidade/],
    ['laudo', /laudo|parecer|vistoria|inspecao|relatorio tecnico|diagnostico/],
    ['guia_estilos', /guia.*estilo|estilo.*arquitet|moodboard|paleta|conceito visual/],
    ['guia_obras', /guia.*obra|manual.*obra|caderno.*obra|execucao.*obra/],
    ['contrato', /contrato|aditivo|distrato|termo de aceite/],
    ['orcamento', /orcamento|proposta|cotacao|estimativa de custo/],
    ['memorial', /memorial|caderno de especifica|especificacao tecnica/],
    ['norma', /(^|\s)(nbr|abnt|norma)(\s|$)/],
    ['modelo', /modelo|template|padrao de documento/],
    ['projeto', /projeto|planta|corte|fachada|detalhamento|layout|levantamento|implantacao/]
  ];

  for (const [categoria, regra] of categorias) {
    if (regra.test(texto)) return categoria;
  }
  return informada || 'outros';
}

function atualizarPastasBibliotecaAdmin(biblioteca, documentos, fotos) {
  const pastas = new Set();

  const registrar = (item, origem) => {
    const cliente = item.cliente_id || 'sem-cliente';
    const projeto = item.projeto_id || 'sem-projeto';
    const categoria = categoriaPastaAdmin(item, origem);
    pastas.add(`${cliente}::${projeto}::${categoria}`);
  };

  (biblioteca || []).forEach(item => registrar(item, 'biblioteca'));
  (documentos || []).forEach(item => registrar(item, 'documento'));
  (fotos || []).forEach(item => registrar(item, 'foto'));

  atualizarNumeroAdmin('totalBiblioteca', pastas.size);
  const elemento = document.getElementById('totalBiblioteca');
  if (elemento) elemento.title = 'Pastas com conteúdo, sem duplicar a quantidade de arquivos';
}

async function carregarArmazenamentoAdmin() {
  const barra = document.getElementById('storageBar');
  const usado = document.getElementById('storageUsado');
  const limiteTexto = document.getElementById('storageLimite');
  const detalhes = document.getElementById('storageDetalhes');
  const trilho = barra?.parentElement;
  const limite = Number(window.CM_CONFIG?.limiteArmazenamentoBytes) || (1024 ** 3);

  if (limiteTexto) limiteTexto.textContent = formatarBytesAdmin(limite);

  try {
    const { data, error } = await window.supabaseClient.rpc('uso_armazenamento_portal');
    if (error) throw error;

    const bytes = Math.max(0, Number(data?.bytes_utilizados) || 0);
    const arquivos = Math.max(0, Number(data?.quantidade_arquivos) || 0);
    const percentual = limite > 0 ? Math.min(100, bytes / limite * 100) : 0;

    if (barra) barra.style.width = `${percentual}%`;
    trilho?.setAttribute('aria-valuenow', String(Math.round(percentual)));
    if (usado) usado.textContent = formatarBytesAdmin(bytes);
    if (detalhes) {
      detalhes.textContent = `${arquivos} ${arquivos === 1 ? 'arquivo' : 'arquivos'} • ${percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% utilizado`;
    }
  } catch (erro) {
    console.warn('Não foi possível calcular o armazenamento:', erro);
    if (barra) barra.style.width = '0%';
    trilho?.setAttribute('aria-valuenow', '0');
    if (usado) usado.textContent = 'Indisponível';
    if (detalhes) detalhes.textContent = 'Armazenamento temporariamente indisponível.';
  }
}

function atualizarNumeroAdmin(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = String(Number(valor) || 0);
}

function formatarBytesAdmin(bytes) {
  const valor = Number(bytes) || 0;
  if (valor <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  const indice = Math.min(Math.floor(Math.log(valor) / Math.log(1024)), unidades.length - 1);
  const numero = valor / (1024 ** indice);
  return `${numero.toLocaleString('pt-BR', { maximumFractionDigits: indice === 0 ? 0 : 2 })} ${unidades[indice]}`;
}

function escaparAdmin(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.setTimeout(ocultarLoadingAdmin, 5000);
