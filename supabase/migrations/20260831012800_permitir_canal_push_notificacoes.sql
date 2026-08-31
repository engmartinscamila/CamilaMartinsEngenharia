-- Permite registrar notificações push no histórico sem remover canais legados.
alter table public.notificacoes_envios
  drop constraint if exists notificacoes_envios_canal_check;

alter table public.notificacoes_envios
  add constraint notificacoes_envios_canal_check
  check (canal = any (array['email'::text,'sms'::text,'push'::text]));
