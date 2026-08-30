(function () {
    'use strict';

    const CATEGORIAS = [
        ['contrato', 'Contrato'],
        ['orcamento', 'Orçamento / Proposta'],
        ['projeto', 'Projeto'],
        ['art', 'ART / RRT'],
        ['guia_estilos', 'Guia de estilos'],
        ['guia_obras', 'Guia de obras'],
        ['laudo', 'Laudo / Parecer'],
        ['memorial', 'Memorial'],
        ['norma', 'Norma técnica'],
        ['modelo', 'Modelo'],
        ['outros', 'Outros']
    ];

    function normalizar(texto) {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

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

    function detectarCategoria(nomeArquivo) {
        const nome = normalizar(nomeArquivo);
        const regras = [
            ['art', /(^|\s)(art|rrt)(\s|$)|anotacao de responsabilidade|registro de responsabilidade/],
            ['guia_estilos', /guia.*estilo|estilo.*arquitet|interiores|moodboard|paleta|conceito visual|tecidos|moveis|iluminacao|lampadas|pisos.*revestimentos|banheiros.*cozinhas/],
            ['guia_obras', /guia.*obra|manual.*obra|caderno.*obra|execucao.*obra|concretagem|armaduras|cobrimento|alvenaria|vergas|contravergas|impermeabilizacao|cobertura|telhas|rufos|calhas|agua.*esgoto|esgoto.*pluvial|eletrica|eletrodutos|circuitos|ar condicionado|ventilacao|exaustao|chapisco|emboco|reboco|drywall|contrapiso|caimentos|pintura.*patologias|loucas.*metais.*tomadas/],
            ['laudo', /laudo|parecer|vistoria|inspecao|relatorio tecnico|diagnostico/],
            ['contrato', /contrato|aditivo|distrato|termo de aceite/],
            ['orcamento', /orcamento|proposta|cotacao|estimativa de custo/],
            ['memorial', /memorial|caderno de especifica|especificacao tecnica/],
            ['norma', /(^|\s)(nbr|abnt|norma)(\s|$)/],
            ['modelo', /modelo|template|padrao de documento/],
            ['projeto', /projeto|planta|corte|fachada|detalhamento|layout|levantamento|implantacao/]
        ];
        for (const [categoria, regra] of regras) {
            if (regra.test(nome)) return categoria;
        }
        return 'outros';
    }

    function rotuloCategoria(valor) {
        return CATEGORIAS.find(([id]) => id === valor)?.[1] || 'Outros';
    }

    function estaEditando() {
        const texto = [
            document.querySelector('#modalDocumento .modal-header h2')?.textContent,
            document.getElementById('salvarDocumento')?.textContent
        ].join(' ');
        return /editar|altera[cç][oõ]es/i.test(texto);
    }

    function criarSelectCategoria(valor, indice) {
        const select = document.createElement('select');
        select.className = 'documento-categoria-lote';
        select.dataset.indice = String(indice);
        select.setAttribute('aria-label', 'Categoria do documento ' + (indice + 1));
        CATEGORIAS.forEach(([id, rotulo]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = rotulo;
            option.selected = id === valor;
            select.appendChild(option);
        });
        return select;
    }

    function iniciar() {
        const formulario = document.getElementById('formDocumento');
        const arquivo = document.getElementById('documentoArquivo');
        const nome = document.getElementById('documentoNome');
        const categoria = document.getElementById('documentoCategoria');
        const botaoSalvar = document.getElementById('salvarDocumento');
        if (!formulario || !arquivo || !nome || !categoria || !botaoSalvar) return;

        arquivo.multiple = true;

        if (!categoria.querySelector('option[value="automatico"]')) {
            const automatico = document.createElement('option');
            automatico.value = 'automatico';
            automatico.textContent = 'Automática pelo nome do arquivo';
            categoria.insertBefore(automatico, categoria.firstChild);
        }
        if (!categoria.querySelector('option[value="modelo"]')) {
            const modelo = document.createElement('option');
            modelo.value = 'modelo';
            modelo.textContent = 'Modelo';
            const outros = categoria.querySelector('option[value="outros"]');
            categoria.insertBefore(modelo, outros || null);
        }

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

        function categoriaParaArquivo(item) {
            return categoria.value === 'automatico' ? detectarCategoria(item.name) : (categoria.value || 'outros');
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
                if (!estaEditando() && categoria.value === 'automatico') {
                    const detectada = detectarCategoria(arquivos[0].name);
                    categoria.value = detectada;
                    status.textContent = 'Categoria detectada automaticamente: ' + rotuloCategoria(detectada) + '. Você pode alterá-la antes de salvar.';
                } else {
                    status.textContent = 'Nome preenchido automaticamente pelo arquivo selecionado.';
                }
                return;
            }

            nome.value = arquivos.length + ' documentos selecionados';
            nome.readOnly = true;
            previa.hidden = false;

            const titulo = document.createElement('strong');
            titulo.textContent = 'Revise os nomes e categorias antes de enviar';
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

                const categoriaDetectada = categoriaParaArquivo(item);
                const selectCategoria = criarSelectCategoria(categoriaDetectada, indice);

                const original = document.createElement('small');
                original.textContent = item.name;

                textos.append(campo, selectCategoria, original);
                linha.append(numero, textos);
                lista.appendChild(linha);
            });

            previa.append(titulo, lista);
            status.textContent = arquivos.length + ' arquivos prontos. Cada arquivo pode ter uma categoria diferente.';
        }

        arquivo.addEventListener('change', renderizarArquivos);

        categoria.addEventListener('change', function () {
            const arquivos = Array.from(arquivo.files || []);
            if (arquivos.length <= 1 || previa.hidden) return;
            const selects = Array.from(previa.querySelectorAll('.documento-categoria-lote'));
            selects.forEach(function (select, indice) {
                select.value = categoria.value === 'automatico'
                    ? detectarCategoria(arquivos[indice]?.name)
                    : (categoria.value || 'outros');
            });
            status.textContent = categoria.value === 'automatico'
                ? 'Categorias recalculadas automaticamente pelo nome de cada arquivo.'
                : 'Categoria “' + rotuloCategoria(categoria.value) + '” aplicada ao lote. Você ainda pode ajustar arquivo por arquivo.';
        });

        document.getElementById('novoDocumento')?.addEventListener('click', function () {
            window.setTimeout(function () {
                limparLote();
                categoria.value = 'automatico';
            }, 0);
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
            const camposNome = Array.from(previa.querySelectorAll('.documento-nome-lote'));
            const camposCategoria = Array.from(previa.querySelectorAll('.documento-categoria-lote'));

            if (!clienteId || !projetoId || camposNome.length !== arquivos.length || camposNome.some((campo) => !campo.value.trim())) {
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
                    const tipo = camposCategoria[indice]?.value || detectarCategoria(item.name);
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
                            arquivo: caminho,
                            nome_original: item.name,
                            autoral: Boolean(window.CMEArquivoAutoralSelecionado?.())
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

                status.textContent = arquivos.length + ' documentos enviados e classificados com sucesso.';
                status.dataset.type = 'sucesso';
                alert(arquivos.length + ' documentos enviados com sucesso.');
                window.setTimeout(() => window.location.reload(), 900);
            } catch (erro) {
                console.error('Erro no envio em lote de documentos.', erro);
                status.textContent = 'O envio parou após ' + concluidos + ' de ' + arquivos.length + ' documentos.';
                status.dataset.type = 'erro';
                alert('Não foi possível concluir todo o lote. ' + concluidos + ' de ' + arquivos.length + ' documentos foram enviados.');
                if (concluidos > 0) window.setTimeout(() => window.location.reload(), 900);
            } finally {
                botaoSalvar.disabled = false;
                botaoSalvar.textContent = 'Salvar Documentos';
            }
        }, true);
    }

    window.CMEClassificarDocumento = detectarCategoria;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
}());
