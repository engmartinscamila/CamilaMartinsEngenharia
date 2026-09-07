-- Remove policies antigas de visibilidade que duplicavam as regras específicas
-- de administrador/cliente e poderiam ampliar acesso entre clientes.
drop policy if exists "Visibilidade configurada agenda" on public.agenda;
drop policy if exists "Visibilidade configurada aprovacoes" on public.aprovacoes;
drop policy if exists "Visibilidade configurada biblioteca" on public.biblioteca;
drop policy if exists "Visibilidade configurada cronograma" on public.cronograma;
drop policy if exists "Visibilidade configurada documentos" on public.documentos;
drop policy if exists "Visibilidade configurada fotos" on public.fotos;
drop policy if exists "Visibilidade configurada solicitacoes" on public.solicitacoes;
