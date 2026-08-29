(function () {
    'use strict';

    function nomeAmigavel(nomeArquivo) {
        return String(nomeArquivo || '')
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function nomeSeguro(nomeArquivo) {
        const partes = String(nomeArquivo || 'arquivo').split('.');
        const extensao = partes.length > 1 ? partes.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const base = nomeAmigavel(partes.join('.'))
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'arquivo';
        return extensao ? base + '.' + extensao : base;
    }

    function estaEditando() {
        const texto = [
            document.querySelector('#modalDocumento .modal-header h2')?.textContent,
            document.getElementById('salvarDocumento')?.textContent
        ].join(' ');
        return /editar|altera[cç][oõ]es/i.test(texto);
    }

    function iniciar() {
        const formulario = document.getElementById('formDocumento');
        const arquivo = document.getElementById('documentoArquivo');
        const nome = document.getElementById('documentoNome');
        const categoria = document.getElementById('documentoCategoria');
        const botaoSalvar = document.getElementById('salvarDocumento');
        if (!formulario || !arquivo || !nome || !categoria || !botaoSalvar) return;

        arquivo.multiple = true;

        const ajuda = arquivo.parentElement.querySelector('.ajuda-campo');
        const previa = document.createElement('div');
        previa.id = 'documentoLotePreview';
        previa.className = 'documento-lote-preview';
        previa.hidden = true;

        const status = document.createElement('p');
        status.id = 'documentoLoteStatus';
        status.className = 'documento-lote-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        (ajuda || arquivo).insertAdjacentElement('afterend', previa);
        previa.insertAdjacentElement('afterend', status);

        function limparLote() {
            previa.hidden = true;
            previa.replaceChildren();
            status.textContent = '';
            status.removeAttribute('data-type');
            nome.readOnly = false;
        }

        function renderizarArquivos() {
            const arquivos = Array.from(arquivo.files || []);
            limparLote();
            if (!arquivos.length) return;

            if (estaEditando() && arquivos.length > 1) {
                arquivo.value = '';
                alert('Ao editar um documento, escolha apenas um arquivo. Para cadastrar vários, use “Novo Documento”.');
                return;
            }

            if (arquivos.length === 1) {
                if (!estaEditando()) nome.value = nomeAmigavel(arquivos[0].name);
                status.textContent = 'Nome preenchido automaticamente pelo arquivo selecionado.';
                return;
            }

            nome.value = arquivos.length + ' documentos selecionados';
            nome.readOnly = true;
            previa.hidden = false;

            const titulo = document.createElement('strong');
            titulo.textContent = 'Revise os nomes antes de enviar';
            const lista = document.createElement('div');
            lista.className = 'documento-lote-lista';

            arquivos.forEach(function (item, indice) {
                const linha = document.createElement('label');
                linha.className = 'documento-lote-item';

                const numero = document.createElement('span');
                numero.textContent = String(indice + 1).padStart(2, '0');

                const textos = document.createElement('span');
                textos.className = 'documento-lote-textos';

                const campo = document.createElement('input');
                campo.type = 'text';
                campo.className = 'documento-nome-lote';
                campo.dataset.indice = String(indice);
                campo.value = nomeAmigavel(item.name);
                campo.required = true;
                campo.setAttribute('aria-label', 'Nome do documento ' + (indice + 1));

                const original = document.createElement('small');
                original.textContent = item.name;

                textos.append(campo, original);
                linha.append(numero, textos);
                lista.appendChild(linha);
            });

            previa.append(titulo, lista);
            status.textContent = arquivos.length + ' arquivos prontos. A categoria escolhida será aplicada a todos.';
        }

        arquivo.addEventListener('change', renderizarArquivos);

        document.getElementById('novoDocumento')?.addEventListener('click', function () {
            window.setTimeout(limparLote, 0);
        });

        formulario.addEventListener('submit', async function (evento) {
            const arquivos = Array.from(arquivo.files || []);
            if (arquivos.length <= 1) return;

            evento.preventDefault();
            evento.stopImmediatePropagation();

            if (estaEditando()) {
                alert('O envio em lote está disponível somente no cadastro de novos documentos.');
                return;
            }

            const clienteId = document.getElementById('documentoCliente')?.value || '';
            const projetoId = document.getElementById('documentoProjeto')?.value || '';
            const descricao = document.getElementById('documentoDescricao')?.value.trim() || '';
            const tipo = categoria.value || 'outros';
            const camposNome = Array.from(previa.querySelectorAll('.documento-nome-lote'));

            if (!clienteId || !projetoId || camposNome.some(function (campo) { return !campo.value.trim(); })) {
                alert('Preencha cliente, projeto e confira o nome de todos os documentos.');
                return;
            }

            botaoSalvar.disabled = true;
            botaoSalvar.textContent = 'Enviando 0 de ' + arquivos.length;
            status.removeAttribute('data-type');
            let concluidos = 0;

            try {
                for (let indice = 0; indice < arquivos.length; indice += 1) {
                    const item = arquivos[indice];
                    const linha = previa.querySelectorAll('.documento-lote-item')[indice];
                    linha?.setAttribute('data-status', 'enviando');
                    status.textContent = 'Enviando ' + (indice + 1) + ' de ' + arquivos.length + ': ' + item.name;
                    botaoSalvar.textContent = 'Enviando ' + (indice + 1) + ' de ' + arquivos.length;

                    const caminho = clienteId + '/' + projetoId + '/' + Date.now() + '-' + indice + '-' + nomeSeguro(item.name);
                    await dbUploadArquivo(BUCKETS.DOCUMENTOS, caminho, item);

                    try {
                        await dbCriarDocumento({
                            nome: camposNome[indice].value.trim(),
                            tipo: tipo,
                            cliente_id: clienteId,
                            projeto_id: projetoId,
                            descricao: descricao,
                            arquivo: caminho
                        });
                    } catch (erroRegistro) {
                        await dbExcluirArquivoStorage(BUCKETS.DOCUMENTOS, caminho).catch(function () {});
                        throw erroRegistro;
                    }

                    concluidos += 1;
                    linha?.setAttribute('data-status', 'concluido');
                }

                if (typeof dbNotificarAtualizacao === 'function') {
                    await dbNotificarAtualizacao({
                        tipo: 'documentos_adicionados',
                        cliente_id: clienteId,
                        projeto_id: projetoId,
                        titulo: arquivos.length + ' documentos adicionados',
                        mensagem: 'Novos documentos foram disponibilizados no portal.'
                    }).catch(function () {});
                }

                status.textContent = arquivos.length + ' documentos enviados com sucesso.';
                status.dataset.type = 'sucesso';
                alert(arquivos.length + ' documentos enviados com sucesso.');
                window.location.reload();
            } catch (erro) {
                console.error('Erro no envio em lote de documentos.', erro);
                status.textContent = 'O envio parou após ' + concluidos + ' de ' + arquivos.length + ' documentos.';
                status.dataset.type = 'erro';
                alert('Não foi possível concluir todo o lote. ' + concluidos + ' de ' + arquivos.length + ' documentos foram enviados.');
                if (concluidos > 0) window.location.reload();
            } finally {
                botaoSalvar.disabled = false;
                botaoSalvar.textContent = 'Salvar Documentos';
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
}());
