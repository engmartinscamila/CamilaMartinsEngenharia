(function () {
    'use strict';

    const alvo = document.getElementById('totalBiblioteca');
    if (!alvo) return;

    let totalConfirmado = null;
    let atualizando = false;

    function quantidade(resultado) {
        return Array.isArray(resultado) ? resultado.length : 0;
    }

    async function atualizar() {
        if (atualizando) return;
        atualizando = true;
        try {
            const tarefas = [
                typeof dbBuscarBiblioteca === 'function' ? dbBuscarBiblioteca() : Promise.resolve([]),
                typeof dbBuscarDocumentos === 'function' ? dbBuscarDocumentos() : Promise.resolve([]),
                typeof dbBuscarFotos === 'function' ? dbBuscarFotos() : Promise.resolve([])
            ];
            const resultados = await Promise.allSettled(tarefas);
            totalConfirmado = resultados.reduce(function (soma, item) {
                return soma + (item.status === 'fulfilled' ? quantidade(item.value) : 0);
            }, 0);
            alvo.textContent = String(totalConfirmado);
            alvo.title = 'Arquivos consolidados: documentos, fotos e biblioteca';
        } catch (erro) {
            console.warn('Não foi possível atualizar o contador consolidado da Biblioteca.', erro);
        } finally {
            atualizando = false;
        }
    }

    const observador = new MutationObserver(function () {
        if (totalConfirmado !== null && alvo.textContent.trim() !== String(totalConfirmado)) {
            alvo.textContent = String(totalConfirmado);
        }
    });
    observador.observe(alvo, { childList: true, characterData: true, subtree: true });

    atualizar();
    window.setTimeout(atualizar, 1200);
    window.setTimeout(atualizar, 3500);
    window.setInterval(atualizar, 60000);
}());
