-- Camila Martins Engenharia — correção aditiva da auditoria de notificações.
--
-- A política RLS criada na migração anterior permite leitura somente à
-- administradora, mas projetos com os privilégios seguros mais recentes do
-- Supabase também exigem o GRANT explícito para alcançar a tabela pela API.

revoke all on table public.notificacoes_envios from anon;
revoke insert, update, delete on table public.notificacoes_envios from authenticated;
grant select on table public.notificacoes_envios to authenticated;

-- Índice necessário para a chave estrangeira e para consultas por projeto.
create index if not exists notificacoes_envios_projeto_data_idx
    on public.notificacoes_envios (projeto_id, created_at desc);
