alter table public.notificacoes add column if not exists scheduled_for timestamptz;
alter table public.notificacoes add column if not exists sent_at timestamptz;
alter table public.notificacoes add column if not exists delivery_status text not null default 'sent';
alter table public.notificacoes add constraint notificacoes_delivery_status_check check (delivery_status in ('scheduled','sent','read','cancelled')) not valid;
create index if not exists notificacoes_scheduled_for_idx on public.notificacoes (scheduled_for) where delivery_status='scheduled';
