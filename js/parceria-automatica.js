(function () {
    "use strict";

    let clientes = [];
    const original = window.dbBuscarClientes;

    if (typeof original === "function" && !original.__cmeParceria) {
        const wrapper = async function (...args) {
            const resultado = await original.apply(this, args);
            clientes = Array.isArray(resultado) ? resultado : [];
            return resultado;
        };
        wrapper.__cmeParceria = true;
        window.dbBuscarClientes = wrapper;
    }

    function aplicar() {
        const select = document.getElementById("projetoCliente");
        const checkbox = document.getElementById("projetoParceria");
        const aviso = document.getElementById("projetoParceriaHerdada");
        if (!select || !checkbox) return;

        const cliente = clientes.find(item => String(item.id) === String(select.value));
        const herdada = cliente?.parceria === true;
        if (herdada) checkbox.checked = true;
        checkbox.dataset.herdada = herdada ? "true" : "false";
        if (aviso) aviso.hidden = !herdada;
    }

    function iniciar() {
        const select = document.getElementById("projetoCliente");
        if (!select) return;
        select.addEventListener("change", aplicar);
        window.setTimeout(aplicar, 450);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
