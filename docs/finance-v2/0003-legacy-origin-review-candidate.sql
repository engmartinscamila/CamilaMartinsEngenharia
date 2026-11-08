-- Registro de classificação de origem: apenas metadados; não atualiza financeiro.
begin;
create table public.financial_origin_review_events (
 id bigint generated always as identity primary key,
 request_id uuid not null unique,
 financial_entry_id uuid not null references public.financeiro(id) on delete restrict,
 classification text not null check(classification in ('servico_avulso','vinculo_pendente')),
 reason text not null check(char_length(btrim(reason)) between 8 and 400),
 entry_snapshot jsonb not null,
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default now()
);
create index financial_origin_review_financial_idx on public.financial_origin_review_events(financial_entry_id,id desc);
alter table public.financial_origin_review_events enable row level security;
revoke all on public.financial_origin_review_events from public,anon,authenticated;
revoke all on sequence public.financial_origin_review_events_id_seq from public,anon,authenticated;
grant select on public.financial_origin_review_events to authenticated;
create policy financial_origin_review_admin_select on public.financial_origin_review_events
 for select to authenticated using ((select public.is_portal_admin()));

create function public.admin_review_financial_origin(
 p_financial_entry_id uuid,p_classification text,p_reason text,p_request_id uuid
)
returns bigint language plpgsql security definer set search_path='' as $body$
declare
 v_existing public.financial_origin_review_events;
 v_entry jsonb;
 v_admin uuid:=auth.uid();
 v_reason text:=btrim(coalesce(p_reason,''));
 v_id bigint;
begin
 if v_admin is null or not public.is_portal_admin() then
  raise exception 'Acesso administrativo obrigatório' using errcode='42501';
 end if;
 if p_request_id is null or p_financial_entry_id is null or
    p_classification not in ('servico_avulso','vinculo_pendente') or p_classification is null or
    char_length(v_reason) not between 8 and 400 then
  raise exception 'Informe lançamento, classificação, justificativa de 8 a 400 caracteres e identificador válido';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-origin:'||p_request_id::text,0));
 select * into v_existing from public.financial_origin_review_events where request_id=p_request_id for update;
 if found then
  if v_existing.financial_entry_id=p_financial_entry_id
   and v_existing.classification=p_classification
   and v_existing.reason=v_reason then
   return v_existing.id;
  end if;
  raise exception 'Identificador de solicitação reutilizado com conteúdo diferente';
 end if;
 select to_jsonb(f) into v_entry from public.financeiro f
 where f.id=p_financial_entry_id for share;
 if v_entry is null then raise exception 'Lançamento financeiro não encontrado';end if;
 if coalesce(v_entry->>'status','') in ('cancelado','cancelada') then
  raise exception 'Lançamento cancelado não pode ser classificado';
 end if;
 if v_entry->>'contract_id' is not null or v_entry->>'projeto_id' is not null then
  raise exception 'Esta classificação só se aplica a lançamento sem contrato e sem projeto';
 end if;
 if v_entry->>'cliente_id' is null then
  raise exception 'O lançamento precisa ter cliente identificado';
 end if;
 if v_entry->>'tipo' not in ('entrada','saida') or nullif(v_entry->>'valor','')::numeric<=0 then
  raise exception 'Tipo ou valor financeiro inválido';
 end if;
 insert into public.financial_origin_review_events
  (request_id,financial_entry_id,classification,reason,entry_snapshot,reviewed_by)
 values(
  p_request_id,p_financial_entry_id,p_classification,v_reason,
  jsonb_build_object('client_id',v_entry->>'cliente_id',
   'project_id',v_entry->>'projeto_id','contract_id',v_entry->>'contract_id',
   'amount',v_entry->>'valor','type',v_entry->>'tipo','status',v_entry->>'status'),
  v_admin)
 returning id into v_id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(v_admin,'financial_origin_review','financeiro',p_financial_entry_id,
  jsonb_build_object('review_id',v_id,'classification',p_classification,'request_id',p_request_id));
 return v_id;
end
$body$;

revoke all on function public.admin_review_financial_origin(uuid,text,text,uuid) from public,anon;
grant execute on function public.admin_review_financial_origin(uuid,text,text,uuid) to authenticated;
commit;
