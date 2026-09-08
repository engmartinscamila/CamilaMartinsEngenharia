-- Legacy uploads use autoral; the newer document flow uses protection_mode.
-- Both must keep authored originals behind server-side copy issuance.
alter policy cliente_le_documentos_storage_proprios on storage.objects using (
  bucket_id = 'documentos' and exists (
    select 1 from public.documentos d
    where d.arquivo = storage.objects.name
    and coalesce(d.storage_bucket,'documentos') = storage.objects.bucket_id
    and coalesce(d.protection_mode,'administrative') <> 'authored_pdf'
    and coalesce(d.autoral,false) = false
  )
);
alter policy cliente_le_biblioteca_storage_propria on storage.objects using (
  bucket_id = 'biblioteca' and exists (
    select 1 from public.biblioteca b
    where b.arquivo = storage.objects.name
    and coalesce(b.storage_bucket,'biblioteca') = storage.objects.bucket_id
    and coalesce(b.autoral,false) = false
  )
);
