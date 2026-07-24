/*
==========================================================
CAMILA MARTINS ENGENHARIA
VERIFICAÇÃO SOMENTE LEITURA DO PORTAL

Execute no SQL Editor depois das migrações.
Este arquivo não altera nem apaga dados.
==========================================================
*/

-- 1. Clientes e situação do acesso.
select
    cliente.id,
    cliente.nome,
    cliente.email,
    cliente.auth_id,
    usuario.email_confirmed_at,
    usuario.last_sign_in_at,
    case
        when cliente.auth_id is null then 'AGUARDANDO PRIMEIRO ACESSO'
        when usuario.email_confirmed_at is null then 'AGUARDANDO CONFIRMAÇÃO DO EMAIL'
        else 'ACESSO ATIVO'
    end as situacao_acesso
from public.clientes as cliente
left join auth.users as usuario
    on usuario.id = cliente.auth_id
order by cliente.nome;

-- 2. Documentos cadastrados e presença do arquivo no Storage.
select
    documento.id,
    documento.nome,
    documento.cliente_id,
    documento.projeto_id,
    documento.arquivo,
    case
        when documento.arquivo is null then 'SEM CAMINHO DE ARQUIVO'
        when objeto.id is null then 'ARQUIVO NÃO ENCONTRADO NO STORAGE'
        else 'ARQUIVO LOCALIZADO'
    end as situacao_arquivo
from public.documentos as documento
left join storage.objects as objeto
    on objeto.bucket_id = 'documentos'
   and objeto.name = documento.arquivo
order by documento.created_at desc;

-- 3. Campos de contrato e orçamento.
select
    projeto.id,
    projeto.nome,
    projeto.numero_contrato,
    projeto.numero_orcamento
from public.projetos as projeto
order by projeto.created_at desc;

-- 4. Políticas necessárias ao portal e ao Storage.
select
    schemaname,
    tablename,
    policyname,
    cmd
from pg_policies
where (
    schemaname = 'public'
    and tablename in (
        'clientes',
        'projetos',
        'documentos',
        'fotos',
        'cronograma',
        'solicitacoes',
        'biblioteca'
    )
)
or (
    schemaname = 'storage'
    and tablename = 'objects'
)
order by schemaname, tablename, policyname;
