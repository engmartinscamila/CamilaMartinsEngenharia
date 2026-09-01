create index if not exists document_archive_batches_status_created_idx on public.document_archive_batches(status, created_at desc);
