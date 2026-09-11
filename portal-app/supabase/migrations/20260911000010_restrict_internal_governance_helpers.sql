revoke execute on function public.current_document_text_snapshot(text) from authenticated;
revoke execute on function public.current_document_text_snapshot_all() from authenticated;
revoke execute on function public.enqueue_document_text_reviews(integer, text, text[]) from authenticated;

grant execute on function public.current_document_text_snapshot(text) to service_role;
grant execute on function public.current_document_text_snapshot_all() to service_role;
grant execute on function public.enqueue_document_text_reviews(integer, text, text[]) to service_role;
