/*
==========================================================
CAMILA MARTINS ENGENHARIA
RECURSOS COMPLEMENTARES DO PORTAL

Execute este arquivo UMA VEZ no SQL Editor do Supabase.
Ele é incremental e não apaga registros existentes.
==========================================================
*/

begin;

alter table public.projetos
    add column if not exists numero_contrato text,
    add column if not exists numero_orcamento text;

comment on column public.projetos.numero_contrato is
    'Número do contrato vinculado ao projeto.';

comment on column public.projetos.numero_orcamento is
    'Número do orçamento vinculado ao projeto.';

commit;

select
    column_name,
    data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'projetos'
  and column_name in ('numero_contrato', 'numero_orcamento')
order by column_name;
