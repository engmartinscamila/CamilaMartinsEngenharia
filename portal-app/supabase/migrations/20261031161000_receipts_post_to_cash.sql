-- Receipt and cash entry commit together; retries and printing never duplicate cash.
alter table public.financeiro add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.financeiro add column if not exists contract_id uuid references public.contratos(id) on delete set null;
create index if not exists financeiro_cliente_id_idx on public.financeiro(cliente_id);
create index if not exists financeiro_contract_id_idx on public.financeiro(contract_id);
create or replace function private.link_receipt_cash(p_receipt_id uuid,p_existing_entry uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.payment_receipts; f public.financeiro; v_id uuid; v_contract uuid;
begin
 select * into r from public.payment_receipts where id=p_receipt_id for update;
 if not found then raise exception 'Recibo não encontrado.'; end if;
 if r.financial_entry_id is not null then
   if p_existing_entry is not null and r.financial_entry_id<>p_existing_entry then raise exception 'Recibo já vinculado a outro recebimento.'; end if;
   return r.financial_entry_id;
 end if;
 select contract_id into v_contract from public.projetos where id=r.project_id;
 if v_contract is null then select id into v_contract from public.contratos where cliente_id=r.client_id and contract_number=r.snapshot->>'contract_number'; end if;
 if p_existing_entry is not null then
   select * into f from public.financeiro where id=p_existing_entry for update;
   if not found or f.tipo is distinct from 'entrada' or f.status not in ('pago','recebido','quitado')
     or f.valor is distinct from r.amount or coalesce(f.data_pagamento,f.data) is distinct from r.paid_on
     or f.projeto_id is distinct from r.project_id
     or coalesce(f.cliente_id,(select cliente_id from public.projetos where id=f.projeto_id)) is distinct from r.client_id
   then raise exception 'O lançamento não corresponde ao pagamento deste recibo.'; end if;
   v_id:=f.id;
   update public.financeiro set cliente_id=r.client_id,contract_id=coalesce(contract_id,v_contract) where id=v_id;
 else
   insert into public.financeiro(projeto_id,cliente_id,contract_id,descricao,tipo,valor,data,status,data_pagamento,data_vencimento,forma_pagamento,categoria,source,observacoes)
   values(r.project_id,r.client_id,v_contract,r.description,'entrada',r.amount,r.paid_on,'pago',r.paid_on,r.paid_on,r.payment_method,'honorarios','receipt',
   'Recebimento do recibo REC-'||lpad(r.receipt_number::text,6,'0'))
   returning id into v_id;
 end if;
 update public.payment_receipts set financial_entry_id=v_id where id=r.id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'link_receipt_cash','payment_receipts',r.id,jsonb_build_object('financial_entry_id',v_id,'created_entry',p_existing_entry is null));
 return v_id;
end $$;
revoke all on function private.link_receipt_cash(uuid,uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_issue_payment_receipt(p_data jsonb)
 RETURNS payment_receipts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.clientes; p public.projetos; r public.payment_receipts; identity_data jsonb; issuer jsonb; doc text; amount_value numeric; paid date; city text; ct public.contratos;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 -- The same request always yields the same immutable receipt, including a lost HTTP response.
 select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid;
 if found then return r; end if;
 select * into c from public.clientes where id=(p_data->>'client_id')::uuid;
 if not found then raise exception 'Cliente não encontrado.'; end if;
 if nullif(p_data->>'project_id','') is not null then
 select * into p from public.projetos where id=(p_data->>'project_id')::uuid and cliente_id=c.id;
 if not found then raise exception 'Selecione um projeto pertencente ao cliente.'; end if;
 end if;
 if coalesce(nullif(p_data->>'contract_id','')::uuid,p.contract_id) is not null then
 select * into ct from public.contratos where id=coalesce(nullif(p_data->>'contract_id','')::uuid,p.contract_id) and cliente_id=c.id;
 if not found or (p.id is not null and p.contract_id is distinct from ct.id) then raise exception 'Contrato incompatível com o cliente/projeto.'; end if;
 end if;
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
 jsonb_build_object('issuer',issuer,'payer_name',c.nome,'payer_document',coalesce(c.cpf_cnpj,''),'project_name',p.nome,'contract_number',ct.contract_number,'city',city),auth.uid())
 on conflict(request_id) do nothing returning * into r;
 if r.id is null then select * into r from public.payment_receipts where request_id=(p_data->>'request_id')::uuid; end if;
 perform private.link_receipt_cash(r.id,nullif(p_data->>'financial_entry_id','')::uuid);
 select * into r from public.payment_receipts where id=r.id;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'issue_payment_receipt','payment_receipts',r.id,jsonb_build_object('receipt_number',r.receipt_number));
 return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_issue_receipt_for_payment(p_financial_id uuid, p_request_id uuid, p_city text)
 RETURNS payment_receipts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.financeiro; p public.projetos; r public.payment_receipts; method text;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 if p_financial_id is null or p_request_id is null then raise exception 'Identifique o recebimento e a solicitação.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_financial_id::text,0));
 select * into r from public.payment_receipts where financial_entry_id=p_financial_id;
 if found then return r; end if;
 select * into f from public.financeiro where id=p_financial_id for share;
 if not found or f.tipo<>'entrada' or lower(coalesce(f.status,'')) not in ('pago','recebido','quitado') then raise exception 'Recibos exigem uma entrada efetivamente recebida.'; end if;
 select * into p from public.projetos where id=f.projeto_id;
 if not found or p.cliente_id is null then raise exception 'O recebimento precisa de um projeto e cliente vinculados.'; end if;
 method:=case lower(coalesce(f.forma_pagamento,'')) when 'pix' then 'Pix' when 'transferência' then 'Transferência' when 'transferencia' then 'Transferência' when 'dinheiro' then 'Dinheiro' when 'cartão' then 'Cartão' when 'cartao' then 'Cartão' when 'boleto' then 'Boleto' else 'Outro' end;
 r:=public.admin_issue_payment_receipt(jsonb_build_object('financial_entry_id',f.id,'request_id',p_request_id,'client_id',p.cliente_id,'project_id',p.id,'amount',f.valor,'paid_on',coalesce(f.data_pagamento,f.data),'payment_method',method,'description',f.descricao,'city',p_city));
 if r.financial_entry_id is distinct from f.id or r.client_id<>p.cliente_id or r.project_id<>p.id or r.amount<>f.valor or r.paid_on<>coalesce(f.data_pagamento,f.data) or r.description<>trim(f.descricao) then raise exception 'A solicitação já pertence a outra emissão. Atualize antes de tentar novamente.'; end if;
 update public.payment_receipts set financial_entry_id=f.id where id=r.id returning * into r;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details) values(auth.uid(),'link_payment_receipt','payment_receipts',r.id,jsonb_build_object('financial_entry_id',f.id));
 return r;
end $function$
;

