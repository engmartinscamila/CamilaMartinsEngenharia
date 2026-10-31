CREATE OR REPLACE FUNCTION public.admin_issue_receipt_for_payment(p_financial_id uuid, p_request_id uuid, p_city text)
 RETURNS payment_receipts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.financeiro; p public.projetos; r public.payment_receipts; method text; v_client uuid;
begin
 if auth.uid() is null or not public.is_portal_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
 if p_financial_id is null or p_request_id is null then raise exception 'Identifique o recebimento e a solicitação.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_financial_id::text,0));
 select * into r from public.payment_receipts where financial_entry_id=p_financial_id;
 if found then return r; end if;
 select * into f from public.financeiro where id=p_financial_id for share;
 if not found or f.tipo<>'entrada' or lower(coalesce(f.status,'')) not in ('pago','recebido','quitado') then raise exception 'Recibos exigem uma entrada efetivamente recebida.'; end if;
 select * into p from public.projetos where id=f.projeto_id;
 v_client:=coalesce(p.cliente_id,f.cliente_id);
 if v_client is null then raise exception 'O recebimento precisa de um cliente vinculado.'; end if;
 method:=case lower(coalesce(f.forma_pagamento,'')) when 'pix' then 'Pix' when 'transferência' then 'Transferência' when 'transferencia' then 'Transferência' when 'dinheiro' then 'Dinheiro' when 'cartão' then 'Cartão' when 'cartao' then 'Cartão' when 'boleto' then 'Boleto' else 'Outro' end;
 r:=public.admin_issue_payment_receipt(jsonb_build_object('financial_entry_id',f.id,'request_id',p_request_id,'client_id',v_client,'contract_id',f.contract_id,'project_id',p.id,'amount',f.valor,'paid_on',coalesce(f.data_pagamento,f.data),'payment_method',method,'description',f.descricao,'city',p_city));
 if r.financial_entry_id is distinct from f.id or r.client_id is distinct from v_client or r.project_id is distinct from p.id or r.amount<>f.valor or r.paid_on<>coalesce(f.data_pagamento,f.data) or r.description<>trim(f.descricao) then raise exception 'A solicitação já pertence a outra emissão. Atualize antes de tentar novamente.'; end if;
 update public.payment_receipts set financial_entry_id=f.id where id=r.id returning * into r;
 insert into public.audit_log(user_id,action,entity_type,entity_id,details) values(auth.uid(),'link_payment_receipt','payment_receipts',r.id,jsonb_build_object('financial_entry_id',f.id));
 return r;
end $function$
;

