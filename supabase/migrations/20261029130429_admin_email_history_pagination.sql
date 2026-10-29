-- Expose only delivery metadata. Never expose payloads, recipient tokens or provider keys.
create or replace function public.admin_client_email_history(p_client_id uuid default null,p_status text default null,p_offset integer default 0,p_limit integer default 50)
returns table(id uuid,client_id uuid,kind text,source_table text,status text,attempts integer,last_error text,created_at timestamptz,sent_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Página inválida.'; end if;
 if p_status is not null and p_status not in ('pending','processing','sent','failed','cancelled','attention') then raise exception 'Situação inválida.'; end if;
 return query select q.id,q.client_id,q.kind,q.source_table,q.status,q.attempts,q.last_error,q.created_at,q.sent_at from public.client_email_queue q
 where (p_client_id is null or q.client_id=p_client_id)
 and (p_status is null or q.status=p_status or p_status='attention' and q.status in ('pending','processing','failed'))
 order by q.created_at desc,q.id desc offset p_offset limit p_limit;
end $$;
revoke all on function public.admin_client_email_history(uuid,text,integer,integer) from public,anon;
grant execute on function public.admin_client_email_history(uuid,text,integer,integer) to authenticated;
