import fs from 'node:fs';

const target = 'site-public/js/cliente-area.js';
if (!fs.existsSync(target)) throw new Error(`Arquivo não encontrado: ${target}`);

let source = fs.readFileSync(target, 'utf8');

const protectedUrlFunction = `    async function urlArquivo(item, bucket) {
        if (!item?.arquivo) return "";

        const bucketDocumentos = window.BUCKETS?.DOCUMENTOS;
        const bucketFotos = window.BUCKETS?.FOTOS;
        const kind = bucket === bucketDocumentos
            ? "document"
            : bucket === bucketFotos
                ? "photo"
                : null;

        if (kind && item?.id && clienteSupabase?.functions?.invoke) {
            const action = kind === "document" && item.permitir_download !== false
                ? "download"
                : "view";
            const { data, error } = await clienteSupabase.functions.invoke(
                "issue-protected-asset",
                { body: { assetId: item.id, kind, action } }
            );

            if (error || !data?.url) {
                console.error(
                    \`Não foi possível emitir acesso protegido para \${kind} \${item.id}.\`,
                    error
                );
                return "";
            }

            return urlSegura(data.url);
        }

        const urlSalva = urlSegura(item?.url);
        if (urlSalva) return urlSalva;

        const { data, error } = await clienteSupabase
            .storage
            .from(bucket)
            .createSignedUrl(item.arquivo, 21600);

        if (error) {
            console.error(
                \`Não foi possível abrir \${bucket}/\${item.arquivo}:\`,
                error
            );
            return "";
        }

        return urlSegura(data?.signedUrl);
    }

    function mostrarErro`;

const urlPattern = /    async function urlArquivo\(item, bucket\) \{[\s\S]*?\n    \}\n\n    function mostrarErro/;
if (!urlPattern.test(source)) throw new Error('Não foi possível localizar urlArquivo para endurecimento.');
source = source.replace(urlPattern, protectedUrlFunction);

const replyFormPattern = /\s*<form class="client-reply-form" data-id="\$\{escapar\(item\.id\)\}">[\s\S]*?<\/form>/;
if (!replyFormPattern.test(source)) throw new Error('Não foi possível localizar o formulário de resposta do cliente.');
source = source.replace(
    replyFormPattern,
    `\n                            <div class="item-meta client-reply-locked"><span><i class="bi bi-shield-check"></i> Aguarde o retorno da engenharia nesta solicitação.</span></div>`
);

const replyListenerPattern = /\n\s*container\.querySelectorAll\("\.client-reply-form"\)\.forEach\(form =>\s*\n\s*form\.addEventListener\("submit", salvarRespostaCliente\)\);/;
if (!replyListenerPattern.test(source)) throw new Error('Não foi possível localizar o listener de resposta do cliente.');
source = source.replace(replyListenerPattern, '');

const replyFunctionPattern = /\n    async function salvarRespostaCliente\(evento\) \{[\s\S]*?\n    \}\n\n    async function salvarSolicitacaoCliente/;
if (!replyFunctionPattern.test(source)) throw new Error('Não foi possível localizar a função de resposta do cliente.');
source = source.replace(replyFunctionPattern, '\n\n    async function salvarSolicitacaoCliente');

if (source.includes('client-reply-form') || source.includes('salvarRespostaCliente')) {
    throw new Error('A remoção da resposta direta do cliente ficou incompleta.');
}
if (!source.includes('issue-protected-asset')) {
    throw new Error('A camada protegida de documentos/fotos não foi aplicada.');
}

fs.writeFileSync(target, source);
console.log('Portal clássico endurecido: ativos protegidos e respostas diretas removidas.');
