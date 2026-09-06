-- O agendamento chama a Edge Function por HTTP; URL e chave pública são
-- configuradas separadamente em cada ambiente durante a publicação.
create extension if not exists pg_net with schema extensions;
