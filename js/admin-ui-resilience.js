/*
=====================================================
CAMILA MARTINS ENGENHARIA
RESILIÊNCIA DA INTERFACE ADMINISTRATIVA
=====================================================
Evita que falhas/atrasos de dados bloqueiem a navegação e garante
ações básicas de interface mesmo se um script de uma página falhar.
*/
(function () {
    'use strict';

    const MODAIS = {
        novoCliente: 'modalCliente',
        novoProjeto: 'modalProjeto',
        novoDocumento: 'modalDocumento',
        novoArquivo: 'modalArquivo',
        gerenciarArmazenamento: 'modalGerenciarStorage',
        novaFoto: 'modalFoto',
        novoLancamento: 'modalFinanceiro',
        novoEvento: 'modalEvento',
        novaSolicitacao: 'modalSolicitacao'
    };

    const FECHAR_MODAIS = {
        fecharModalCliente: 'modalCliente',
        cancelarCliente: 'modalCliente',
        fecharModalProjeto: 'modalProjeto',
        cancelarProjeto: 'modalProjeto',
        fecharModalDocumento: 'modalDocumento',
        cancelarDocumento: 'modalDocumento',
        fecharModalArquivo: 'modalArquivo',
        cancelarArquivo: 'modalArquivo',
        fecharGerenciadorStorage: 'modalGerenciarStorage',
        cancelarGerenciadorStorage: 'modalGerenciarStorage',
        fecharModalFoto: 'modalFoto',
        cancelarFoto: 'modalFoto',
        fecharModalFinanceiro: 'modalFinanceiro',
        cancelarLancamento: 'modalFinanceiro',
        fecharModalEvento: 'modalEvento',
        cancelarEvento: 'modalEvento'
    };

    const NAVEGACAO_DASHBOARD = {
        abrirClientes: 'clientes.html',
        abrirProjetos: 'projetos.html',
        abrirDocumentos: 'documentos.html',
        abrirBiblioteca: 'biblioteca.html',
        abrirFotos: 'fotos.html',
        abrirFinanceiro: 'financeiro.html',
        abrirAgenda: 'agenda.html',
        abrirConfiguracoes: 'configuracoes.html',
        verTodosProjetos: 'projetos.html',
        verTodosDocumentos: 'documentos.html'
    };

    function esconderLoading() {
        document.querySelectorAll('#loading, #loader, #carregando, .loading').forEach((elemento) => {
            elemento.style.setProperty('display', 'none', 'important');
            elemento.style.setProperty('pointer-events', 'none', 'important');
            elemento.setAttribute('aria-hidden', 'true');
            elemento.dataset.uiFailsafeHidden = 'true';
        });
    }

    function abrirModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return false;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        return true;
    }

    function fecharModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }

    function vincularUmaVez(elemento, chave, evento, callback, opcoes) {
        if (!elemento || elemento.dataset[chave] === 'true') return;
        elemento.dataset[chave] = 'true';
        elemento.addEventListener(evento, callback, opcoes);
    }

    function configurarNavegacao() {
        Object.entries(NAVEGACAO_DASHBOARD).forEach(([id, destino]) => {
            const botao = document.getElementById(id);
            vincularUmaVez(botao, 'uiNavBound', 'click', () => {
                window.location.assign(destino);
            });
        });

        const novoProjeto = document.getElementById('novoProjeto');
        if (novoProjeto && !document.getElementById('modalProjeto')) {
            vincularUmaVez(novoProjeto, 'uiNavBound', 'click', () => {
                window.location.assign('projetos.html');
            });
        }
    }

    function configurarModais() {
        Object.entries(MODAIS).forEach(([botaoId, modalId]) => {
            const botao = document.getElementById(botaoId);
            const modal = document.getElementById(modalId);
            if (!botao || !modal) return;

            vincularUmaVez(botao, 'uiModalBound', 'click', (evento) => {
                evento.preventDefault();
                abrirModal(modalId);
            });
        });

        Object.entries(FECHAR_MODAIS).forEach(([botaoId, modalId]) => {
            const botao = document.getElementById(botaoId);
            if (!botao) return;

            vincularUmaVez(botao, 'uiCloseBound', 'click', (evento) => {
                evento.preventDefault();
                fecharModal(modalId);
            });
        });

        document.querySelectorAll('.modal').forEach((modal) => {
            vincularUmaVez(modal, 'uiBackdropBound', 'click', (evento) => {
                if (evento.target === modal) fecharModal(modal.id);
            });
        });

        if (!document.documentElement.dataset.uiEscapeBound) {
            document.documentElement.dataset.uiEscapeBound = 'true';
            document.addEventListener('keydown', (evento) => {
                if (evento.key !== 'Escape') return;
                document.querySelectorAll('.modal.show').forEach((modal) => fecharModal(modal.id));
            });
        }
    }

    function configurarPesquisaDashboard() {
        const botao = document.getElementById('btnPesquisarCliente');
        const campo = document.getElementById('pesquisaCliente');

        if (botao && typeof window.pesquisarClientes === 'function') {
            vincularUmaVez(botao, 'uiSearchBound', 'click', () => window.pesquisarClientes());
        }

        if (campo && typeof window.pesquisarClientes === 'function') {
            vincularUmaVez(campo, 'uiSearchBound', 'keydown', (evento) => {
                if (evento.key === 'Enter') {
                    evento.preventDefault();
                    window.pesquisarClientes();
                }
            });
        }
    }

    function ativarInterface() {
        // No dashboard antigo, configurarEventos() era chamado somente
        // depois de todas as consultas. Se uma consulta ficasse pendurada,
        // nenhum botão era ativado. Registramos esses eventos imediatamente.
        if (
            typeof window.configurarEventos === 'function' &&
            !window.__CME_ADMIN_EVENTS_EARLY__
        ) {
            window.__CME_ADMIN_EVENTS_EARLY__ = true;
            try {
                window.configurarEventos();
            } catch (erro) {
                console.warn('Falha ao antecipar eventos do dashboard.', erro);
            }
        }

        if (
            typeof window.configurarEventosConfiguracoes === 'function' &&
            !window.__CME_CONFIG_EVENTS_EARLY__
        ) {
            window.__CME_CONFIG_EVENTS_EARLY__ = true;
            try {
                window.configurarEventosConfiguracoes();
            } catch (erro) {
                console.warn('Falha ao antecipar eventos de configurações.', erro);
            }
        }

        configurarNavegacao();
        configurarModais();
        configurarPesquisaDashboard();

        // O loader não pode bloquear a área administrativa.
        // Os dados continuam carregando em segundo plano.
        window.setTimeout(esconderLoading, 350);
        window.setTimeout(esconderLoading, 1800);
        window.setTimeout(esconderLoading, 6000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ativarInterface, { once: true });
    } else {
        ativarInterface();
    }

    window.addEventListener('load', () => window.setTimeout(esconderLoading, 150), { once: true });

    window.addEventListener('error', () => {
        window.setTimeout(esconderLoading, 50);
    });

    window.addEventListener('unhandledrejection', () => {
        window.setTimeout(esconderLoading, 50);
    });
}());
