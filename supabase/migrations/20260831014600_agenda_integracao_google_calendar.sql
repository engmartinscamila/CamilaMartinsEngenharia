
alter table public.agenda
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_meet_link text,
  add column if not exists google_sync_status text,
  add column if not exists google_sync_error text,
  add column if not exists google_synced_at timestamptz;

create unique index if not exists agenda_google_event_id_uidx
  on public.agenda (google_event_id)
  where google_event_id is not null;

create index if not exists agenda_google_sync_status_idx
  on public.agenda (google_sync_status);
