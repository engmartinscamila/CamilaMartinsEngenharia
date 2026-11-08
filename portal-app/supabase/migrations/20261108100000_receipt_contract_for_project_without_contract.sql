-- Recibos: projeto ainda sem contrato (criado no cadastro do cliente, PR #76)
-- passa a aceitar um contrato do MESMO cliente, como já aceita o lançamento
-- financeiro (guarda A03). Antes, o recebimento com contrato e projeto sem
-- contrato era aceito no Financeiro, mas a emissão do recibo falhava com
-- "Contrato incompatível com o cliente/projeto".
-- Única mudança: a condição do contrato; o restante é idêntico à produção.
-- Reversão: reaplicar a função de 20261031161000_receipts_post_to_cash.sql.
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
 if not found or (p.id is not null and p.contract_id is not null and p.contract_id is distinct from ct.id) then raise exception 'Contrato incompatível com o cliente/projeto.'; end if;
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
