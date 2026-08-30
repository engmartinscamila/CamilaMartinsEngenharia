(function () {
    "use strict";

    let clientes = [];
    let projetos = [];

    function checkbox(id) {
        return document.getElementById(id);
    }

    function booleanoCampo(id) {
        return Boolean(checkbox(id)?.checked);
    }

    function marcarIntocado(campo) {
        if (!campo) return;
        campo.dataset.touched = "false";
    }

    function acompanharAlteracao(campo) {
        if (!campo || campo.__cmeParceriaTouched) return;
        campo.__cmeParceriaTouched = true;
        campo.addEventListener("change", () => {
            campo.dataset.touched = "true";
        });
    }

    function envolverBusca(nome, destino) {
        const original = window[nome];
        if (typeof original !== "function" || original.__cmeParceriaBusca) return;
        const wrapper = async function (...args) {
            const resultado = await original.apply(this, args);
            destino(Array.isArray(resultado) ? resultado : []);
            return resultado;
        };
        wrapper.__cmeParceriaBusca = true;
        window[nome] = wrapper;
    }

    function envolverGravacao(nome, indicePayload, indiceId, campoId, colecao) {
        const original = window[nome];
        if (typeof original !== "function" || original.__cmeParceriaGravacao) return;

        const wrapper = async function (...args) {
            const payload = args[indicePayload];
            if (payload && typeof payload === "object") {
                const campo = checkbox(campoId);
                const editando = indiceId >= 0;
                const id = editando ? args[indiceId] : null;
                const existente = editando
                    ? colecao().find(item => String(item.id) === String(id))
                    : null;

                const parceria = editando && campo?.dataset.touched !== "true"
                    ? Boolean(existente?.parceria)
                    : booleanoCampo(campoId);

                args[indicePayload] = { ...payload, parceria };
            }
            return original.apply(this, args);
        };

        wrapper.__cmeParceriaGravacao = true;
        window[nome] = wrapper;
    }

    function aplicarParceriaClienteNoProjeto() {
        const select = document.getElementById("projetoCliente");
        const campo = checkbox("projetoParceria");
        const aviso = document.getElementById("projetoParceriaHerdada");
        if (!select || !campo) return;

        const cliente = clientes.find(item => String(item.id) === String(select.value));
        const herdada = cliente?.parceria === true;

        if (herdada) {
            campo.checked = true;
            marcarIntocado(campo);
        } else if (campo.dataset.herdada === "true" && campo.dataset.touched !== "true") {
            campo.checked = false;
        }

        campo.dataset.herdada = herdada ? "true" : "false";
        if (aviso) aviso.hidden = !herdada;
    }

    function prepararCliente() {
        const campo = checkbox("clienteParceria");
        if (!campo) return;
        acompanharAlteracao(campo);

        document.getElementById("novoCliente")?.addEventListener("click", () => {
            campo.checked = false;
            marcarIntocado(campo);
        }, true);

        // A gravação preserva o valor existente em edições quando o checkbox
        // não foi tocado, evitando apagar uma parceria por causa de código legado.
        marcarIntocado(campo);
    }

    function prepararProjeto() {
        const select = document.getElementById("projetoCliente");
        const campo = checkbox("projetoParceria");
        if (!select || !campo) return;

        acompanharAlteracao(campo);
        select.addEventListener("change", aplicarParceriaClienteNoProjeto);

        document.getElementById("novoProjeto")?.addEventListener("click", () => {
            campo.checked = false;
            campo.dataset.herdada = "false";
            marcarIntocado(campo);
            window.setTimeout(aplicarParceriaClienteNoProjeto, 80);
        }, true);

        marcarIntocado(campo);
        window.setTimeout(aplicarParceriaClienteNoProjeto, 450);
    }

    envolverBusca("dbBuscarClientes", resultado => { clientes = resultado; });
    envolverBusca("dbBuscarProjetos", resultado => { projetos = resultado; });

    envolverGravacao("dbCriarCliente", 0, -1, "clienteParceria", () => clientes);
    envolverGravacao("dbEditarCliente", 1, 0, "clienteParceria", () => clientes);
    envolverGravacao("dbCriarProjeto", 0, -1, "projetoParceria", () => projetos);
    envolverGravacao("dbEditarProjeto", 1, 0, "projetoParceria", () => projetos);

    function iniciar() {
        prepararCliente();
        prepararProjeto();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
