/*
=====================================================
CAMILA MARTINS ENGENHARIA
CONFIGURACOES.JS
=====================================================
*/

document.addEventListener("DOMContentLoaded", () => {
    iniciarConfiguracoes();
});

async function iniciarConfiguracoes() {
    try {
        const config = await dbBuscarConfiguracoes();

        if (config) {
            preencherCampo("empresaNome", config.nome_empresa);
            preencherCampo("empresaCnpj", config.cnpj);
            preencherCampo("empresaCrea", config.crea);
            preencherCampo("empresaEmail", config.email);
            preencherCampo("empresaTelefone", config.telefone);
            preencherCampo("empresaEndereco", config.endereco);
            preencherCampo("empresaCidade", config.cidade);
            preencherCampo("empresaEstado", config.estado);
            preencherCampo("empresaDescricao", config.descricao);
            preencherCampo("sistemaTema", config.tema);
            preencherCampo("sistemaCorPrincipal", config.cor_principal);
            preencherCampoCheckbox("sistemaNotificacoes", config.notificacoes);
        }

        configurarEventosConfiguracoes();
    }
    catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

function preencherCampo(id, valor) {
    const el = document.getElementById(id);
    if (el && valor !== undefined && valor !== null) el.value = valor;
}

function preencherCampoCheckbox(id, valor) {
    const el = document.getElementById(id);
    if (el) el.checked = !!valor;
}

function configurarEventosConfiguracoes() {
    document.getElementById("formConfiguracoes")?.addEventListener("submit", salvarConfiguracoesEmpresa);

    document.getElementById("gerarBackup")?.addEventListener("click", gerarBackup);
    document.getElementById("limparCache")?.addEventListener("click", limparCache);
}

async function salvarConfiguracoesEmpresa(e) {
    e.preventDefault();

    const dados = {
        nome_empresa: document.getElementById("empresaNome")?.value.trim() || "",
        cnpj: document.getElementById("empresaCnpj")?.value.trim() || "",
        crea: document.getElementById("empresaCrea")?.value.trim() || "",
        email: document.getElementById("empresaEmail")?.value.trim() || "",
        telefone: document.getElementById("empresaTelefone")?.value.trim() || "",
        endereco: document.getElementById("empresaEndereco")?.value.trim() || "",
        cidade: document.getElementById("empresaCidade")?.value.trim() || "",
        estado: document.getElementById("empresaEstado")?.value.trim() || "",
        descricao: document.getElementById("empresaDescricao")?.value.trim() || "",
        tema: document.getElementById("sistemaTema")?.value || "",
        cor_principal: document.getElementById("sistemaCorPrincipal")?.value || "",
        notificacoes: document.getElementById("sistemaNotificacoes")?.checked || false
    };

    try {
        await dbSalvarConfiguracoes(dados);
        alert("Configurações salvas com sucesso!");
    }
    catch (error) {
        console.error("Erro ao salvar configurações:", error);
        alert("Não foi possível salvar as configurações.");
    }
}

async function gerarBackup() {
    try {
        const [clientes, projetos, documentos, fotos, financeiro, agenda, biblioteca] =
            await Promise.all([
                dbBuscarClientes().catch(() => []),
                dbBuscarProjetos().catch(() => []),
                dbBuscarDocumentos().catch(() => []),
                dbBuscarFotos().catch(() => []),
                dbBuscarFinanceiro().catch(() => []),
                dbBuscarAgenda().catch(() => []),
                dbBuscarBiblioteca().catch(() => [])
            ]);

        const backup = {
            gerado_em: new Date().toISOString(),
            clientes, projetos, documentos, fotos, financeiro, agenda, biblioteca
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }
    catch (error) {
        console.error("Erro ao gerar backup:", error);
        alert("Não foi possível gerar o backup.");
    }
}

function limparCache() {
    if (!confirm("Isso vai recarregar a página. Deseja continuar?")) return;
    location.reload(true);
}
