/*
=====================================================
CAMILA MARTINS ENGENHARIA
Compatibilidade segura para exclusão definitiva no portal clássico.
Mantém o fluxo legado de interface, mas usa somente admin-delete-client.
=====================================================
*/
(function () {
    'use strict';

    async function readFunctionError(error, fallback) {
        let message = error?.message || fallback;
        try {
            const context = error?.context;
            if (context && typeof context.json === 'function') {
                const payload = await context.json();
                if (payload?.error) message = payload.error;
            }
        } catch (_) {
            // Mantém mensagem genérica quando a resposta HTTP não puder ser lida.
        }
        return message;
    }

    async function safeDeleteClient(clientId) {
        if (!window.supabaseClient) {
            throw new Error('Não foi possível iniciar a exclusão segura. Atualize a página e tente novamente.');
        }

        const id = String(clientId || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            throw new Error('Cliente inválido.');
        }

        const { data: client, error: clientError } = await window.supabaseClient
            .from('clientes')
            .select('id,nome')
            .eq('id', id)
            .maybeSingle();

        if (clientError) throw clientError;
        if (!client?.nome) throw new Error('Cliente não encontrado.');

        const previewResult = await window.supabaseClient.functions.invoke('admin-delete-client', {
            body: { action: 'preview', clientId: id }
        });

        if (previewResult.error) {
            throw new Error(await readFunctionError(
                previewResult.error,
                'Não foi possível verificar se a exclusão é permitida.'
            ));
        }

        const preview = previewResult.data?.preview;
        if (!preview) {
            throw new Error('A prévia segura da exclusão não foi retornada. Nenhum dado foi removido.');
        }

        if (preview.canDelete !== true) {
            throw new Error(
                'A exclusão definitiva foi bloqueada porque existem registros documentais ou fiscais que devem ser preservados. Use Arquivar ou Revogar acesso.'
            );
        }

        const expectedName = String(client.nome).trim();
        const typedName = window.prompt(
            `Confirmação final de segurança:\n\nDigite exatamente o nome completo do cliente para excluir definitivamente:\n${expectedName}`
        );

        if (typedName === null) {
            throw new Error('Exclusão cancelada. Nenhum dado foi removido.');
        }

        if (typedName.trim() !== expectedName) {
            throw new Error('O nome digitado não corresponde ao cliente. Exclusão cancelada.');
        }

        const deleteResult = await window.supabaseClient.functions.invoke('admin-delete-client', {
            body: {
                action: 'delete',
                clientId: id,
                confirmation: typedName.trim()
            }
        });

        if (deleteResult.error) {
            throw new Error(await readFunctionError(
                deleteResult.error,
                'Não foi possível concluir a exclusão segura.'
            ));
        }

        if (deleteResult.data?.deleted !== true) {
            throw new Error(deleteResult.data?.error || 'A exclusão não foi confirmada pelo servidor.');
        }

        const deletedObjects = Number(deleteResult.data.deletedObjects || 0);
        const deletedProjects = Number(deleteResult.data.deletedProjects || 0);

        return {
            ...deleteResult.data,
            sucesso: true,
            arquivos_removidos: deletedObjects,
            projetos_removidos: deletedProjects
        };
    }

    // database.js declara a função global usada pelo módulo clientes.js.
    // Sobrescrevê-la aqui preserva a tela antiga sem reativar o endpoint legado 410.
    window.dbExcluirClienteCompleto = safeDeleteClient;
})();
