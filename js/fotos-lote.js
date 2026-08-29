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
        const partes = String(nomeArquivo || 'imagem').split('.');
        const extensao = partes.length > 1 ? partes.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const base = nomeAmigavel(partes.join('.'))
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'imagem';
        return extensao ? base + '.' + extensao : base;
    }

    function estaEditando() {
        const texto = [
            document.querySelector('#modalFoto .modal-header h2')?.textContent,
            document.getElementById('salvarFoto')?.textContent
        ].join(' ');
        return /editar|altera[cç][oõ]es/i.test(texto);
    }

    function iniciar() {
        const formulario = document.getElementById('formFoto');
        const arquivo = document.getElementById('arquivoFoto');
        const titulo = document.getElementById('fotoTitulo');
        const botaoSalvar = document.getElementById('salvarFoto');
        if (!formulario || !arquivo || !titulo || !botaoSalvar) return;

        arquivo.multiple = true;

        const previa = document.createElement('div');
        previa.id = 'fotoLotePreview';
        previa.className = 'documento-lote-preview';
        previa.hidden = true;

        const status = document.createElement('p');
        status.id = 'fotoLoteStatus';
        status.className = 'documento-lote-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        arquivo.insertAdjacentElement('afterend', previa);
        previa.insertAdjacentElement('afterend', status);

        function limparLote() {
            previa.hidden = true;
            previa.replaceChildren();
            status.textContent = '';
            status.removeAttribute('data-type');
            titulo.readOnly = false;
        }

        function renderizarArquivos() {
            const arquivos = Array.from(arquivo.files || []);
            limparLote();
            if (!arquivos.length) return;

            if (estaEditando() && arquivos.length > 1) {
                arquivo.value = '';
                alert('Ao editar uma foto, escolha apenas uma imagem. Para cadastrar várias, use “Nova Foto”.');
                return;
            }

            if (arquivos.length === 1) {
                if (!estaEditando()) titulo.value = nomeAmigavel(arquivos[0].name);
                status.textContent = 'Título preenchido automaticamente pelo nome da imagem.';
                return;
            }

            titulo.value = arquivos.length + ' imagens selecionadas';
            titulo.readOnly = true;
            previa.hidden = false;

            const cabecalho = document.createElement('strong');
            cabecalho.textContent = 'Revise os títulos antes de enviar';
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
                campo.className = 'foto-titulo-lote';
                campo.dataset.indice = String(indice);
                campo.value = nomeAmigavel(item.name);
                campo.required = true;
                campo.setAttribute('aria-label', 'Título da foto ' + (indice + 1));

                const original = document.createElement('small');
                original.textContent = item.name;

                textos.append(campo, original);
                linha.append(numero, textos);
                lista.appendChild(linha);
            });

            previa.append(cabecalho, lista);
            status.textContent = arquivos.length + ' imagens prontas para envio.';
        }

        arquivo.addEventListener('change', renderizarArquivos);

        document.getElementById('novaFoto')?.addEventListener('click', function () {
            window.setTimeout(limparLote, 0);
        });

        formulario.addEventListener('submit', async function (evento) {
            const arquivos = Array.from(arquivo.files || []);
            if (arquivos.length <= 1) return;

            evento.preventDefault();
            evento.stopImmediatePropagation();

            if (estaEditando()) {
                alert('O envio em lote está disponível somente no cadastro de novas fotos.');
                return;
            }

            const clienteId = document.getElementById('fotoCliente')?.value || '';
            const projetoId = document.getElementById('fotoProjeto')?.value || '';
            const descricao = document.getElementById('fotoDescricao')?.value.trim() || '';
            const camposTitulo = Array.from(previa.querySelectorAll('.foto-titulo-lote'));

            if (!clienteId || !projetoId || camposTitulo.some(function (campo) { return !campo.value.trim(); })) {
                alert('Selecione cliente e projeto e confira o título de todas as fotos.');
                return;
            }

            botaoSalvar.disabled = true;
            botaoSalvar.textContent = 'Enviando 0 de ' + arquivos.length;
            status.removeAttribute('data-type');
            let concluidas = 0;

            try {
                for (let indice = 0; indice < arquivos.length; indice += 1) {
                    const item = arquivos[indice];
                    const linha = previa.querySelectorAll('.documento-lote-item')[indice];
                    linha?.setAttribute('data-status', 'enviando');
                    status.textContent = 'Enviando ' + (indice + 1) + ' de ' + arquivos.length + ': ' + item.name;
                    botaoSalvar.textContent = 'Enviando ' + (indice + 1) + ' de ' + arquivos.length;

                    const caminho = clienteId + '/' + projetoId + '/' + Date.now() + '-' + indice + '-' + nomeSeguro(item.name);
                    await dbUploadArquivo(BUCKETS.FOTOS, caminho, item);

                    try {
                        await dbCriarFoto({
                            nome: camposTitulo[indice].value.trim(),
                            descricao: descricao,
                            cliente_id: clienteId,
                            projeto_id: projetoId,
                            arquivo: caminho
                        });
                    } catch (erroRegistro) {
                        await dbExcluirArquivoStorage(BUCKETS.FOTOS, caminho).catch(function () {});
                        throw erroRegistro;
                    }

                    concluidas += 1;
                    linha?.setAttribute('data-status', 'concluido');
                }

                if (typeof dbNotificarAtualizacao === 'function') {
                    await dbNotificarAtualizacao({
                        tipo: 'fotos_adicionadas',
                        cliente_id: clienteId,
                        projeto_id: projetoId,
                        titulo: arquivos.length + ' fotos adicionadas',
                        mensagem: 'Novas fotos foram disponibilizadas na galeria do projeto.'
                    }).catch(function () {});
                }

                status.textContent = arquivos.length + ' fotos enviadas com sucesso.';
                status.dataset.type = 'sucesso';
                alert(arquivos.length + ' fotos enviadas com sucesso.');
                window.location.reload();
            } catch (erro) {
                console.error('Erro no envio em lote de fotos.', erro);
                status.textContent = 'O envio parou após ' + concluidas + ' de ' + arquivos.length + ' fotos.';
                status.dataset.type = 'erro';
                alert('Não foi possível concluir todo o lote. ' + concluidas + ' de ' + arquivos.length + ' fotos foram enviadas.');
                if (concluidas > 0) window.location.reload();
            } finally {
                botaoSalvar.disabled = false;
                botaoSalvar.textContent = 'Salvar Fotos';
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
}());
