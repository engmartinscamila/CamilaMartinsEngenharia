-- Cliente passa a ter três manifestações inequívocas: aceitar, aceitar com ressalvas ou recusar.
-- O admin continua sem permissão de responder no lugar do cliente.

create or replace function public.respond_to_own_approval(
  p_aprovacao_id uuid,
  p_status text,
  p_comentario text default null::text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_client_id uuid := public.current_client_id();
begin
  if v_client_id is null then
    raise exception 'Perfil de cliente necessário';
  end if;

  if p_status not in ('aprovado', 'aprovado_com_ressalvas', 'rejeitado') then
    raise exception 'Status inválido';
  end if;

  if p_status in ('aprovado_com_ressalvas', 'rejeitado')
     and length(btrim(coalesce(p_comentario, ''))) < 3 then
    raise exception 'Comentário obrigatório';
  end if;

  update public.aprovacoes a
     set status = p_status,
         comentario = nullif(btrim(coalesce(p_comentario, '')), ''),
         respondido_at = now()
   where a.id = p_aprovacao_id
     and a.status = 'aguardando'
     and (
       a.cliente_id = v_client_id
       or exists (
         select 1
           from public.projetos p
          where p.id = a.projeto_id
            and p.cliente_id = v_client_id
       )
     );

  return found;
end;
$function$;

revoke all on function public.respond_to_own_approval(uuid,text,text) from public;
grant execute on function public.respond_to_own_approval(uuid,text,text) to authenticated;
