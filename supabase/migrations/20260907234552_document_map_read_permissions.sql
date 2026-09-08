-- client_document_map now uses SECURITY INVOKER. Grant only the read operation
-- needed by its join; existing project/administrator RLS still filters rows.
grant select on public.document_acceptances to authenticated;
