create table if not exists public.payment_receipts (
 id uuid primary key default gen_random_uuid(),
 receipt_number bigint generated always as identity unique,
 request_id uuid not null unique,
 client_id uuid not null references public.clientes(id) on delete restrict,
 project_id uuid not null references public.projetos(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0),
 paid_on date not null,
 payment_method text not null check(payment_method in ('Pix','Transferência','Dinheiro','Cartão','Boleto','Outro')),
 description text not null check(length(trim(description)) between 3 and 4000),
 snapshot jsonb not null,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.payment_receipts enable row level security;
revoke all on public.payment_receipts from public,anon,authenticated;
grant select on public.payment_receipts to authenticated;
create policy payment_receipts_admin_read on public.payment_receipts for select to authenticated using ((select public.is_portal_admin()));
create index if not exists payment_receipts_client_idx on public.payment_receipts(client_id);
create index if not exists payment_receipts_project_idx on public.payment_receipts(project_id);
create index if not exists payment_receipts_creator_idx on public.payment_receipts(created_by);

create or replace function public.admin_issue_payment_receipt(p_data jsonb)
returns public.payment_receipts language plpgsql security definer set search_path='' as $$
declare c public.clientes; p public.projetos; r public.payment_receipts; identity_data jsonb; issuer jsonb; doc text; amount_value numeric; paid date; city text;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 -- The same request always yields the same immutable receipt, including a lost HTTP response.
 select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid;
 if found then return r; end if;
 select * into c from public.clientes where id=(p_data->>'client_id')::uuid;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 select * into p from public.projetos where id=(p_data->>'project_id')::uuid and cliente_id=c.id;
 if not found then raise exception 'Selecione um projeto pertencente ao cliente.'; end if;
 amount_value:=(p_data->>'amount')::numeric; paid:=(p_data->>'paid_on')::date;
 if amount_value is null or amount_value<=0 or amount_value<>round(amount_value,2) then raise exception 'Informe o valor recebido com até duas casas decimais.'; end if;
 if paid is null or paid>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Informe uma data de pagamento já realizado.'; end if;
 city:=trim(p_data->>'city');
 if coalesce(length(city),0)<2 or length(city)>160 then raise exception 'Informe a cidade de emissão.'; end if;
 identity_data:=public.service_get_professional_identity();
 doc:=regexp_replace(coalesce(nullif(identity_data->>'cpf',''),identity_data->>'cnpj',''),'\D','','g');
 if coalesce(length(identity_data->>'full_name'),0)<3 or length(doc) not in(11,14) then raise exception 'Complete o nome e CPF/CNPJ da profissional em Configurações antes de emitir.'; end if;
 issuer:=jsonb_build_object('name',identity_data->>'full_name','document',doc,'title',identity_data->>'professional_title');
 insert into public.payment_receipts(request_id,client_id,project_id,amount,paid_on,payment_method,description,snapshot,created_by)
 values((p_data->>'request_id')::uuid,c.id,p.id,amount_value,paid,p_data->>'payment_method',trim(p_data->>'description'),
 jsonb_build_object('issuer',issuer,'payer_name',c.nome,'payer_document',coalesce(c.cpf_cnpj,''),'project_name',p.nome,'contract_number',(select contract_number from public.contratos where id=p.contract_id),'city',city),auth.uid())
 on conflict(request_id) do nothing returning * into r;
 if r.id is null then select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid; end if;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'issue_payment_receipt','payment_receipts',r.id,jsonb_build_object('receipt_number',r.receipt_number));
 return r;
end $$;
revoke all on function public.admin_issue_payment_receipt(jsonb) from public,anon;
grant execute on function public.admin_issue_payment_receipt(jsonb) to authenticated;
