/*
=====================================================
CAMILA MARTINS ENGENHARIA
UTILS.JS - Funções utilitárias genéricas
=====================================================
*/

function formatarData(data) {
    if (!data) return "";
    return new Date(data).toLocaleDateString(APP_CONFIG.FORMATO_DATA);
}

function debounce(fn, espera = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), espera);
    };
}

function textoOuVazio(valor) {
    return valor === undefined || valor === null ? "" : valor;
}
