begin;
do $$
declare admin_id uuid; c uuid; p uuid; request uuid:=gen_random_uuid(); result public.payment_receipts; again public.payment_receipts; body jsonb;
begin
 select user_id into admin_id from public.pdf_admins limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 insert into public.clientes(nome,email,status) values('[TESTE] Recibo','delivered+receipt-'||gen_random_uuid()||'@resend.dev','ativo') returning id into c;
 insert into public.projetos(cliente_id,nome) values(c,'[TESTE] Recibo') returning id into p;
 body:=jsonb_build_object('request_id',request,'client_id',c,'project_id',p,'amount',1234.56,'paid_on',current_date-1,'payment_method','Pix','description','Teste reversível de recibo','city','São Paulo');
 result:=public.admin_issue_payment_receipt(body);
 again:=public.admin_issue_payment_receipt(body);
 if (public.admin_client_deletion_preview(c)->>'canDelete')::boolean is distinct from false then raise exception 'Recibo não bloqueou a exclusão do cadastro'; end if;
 if result.id<>again.id or result.amount<>1234.56 or result.snapshot->>'payer_name'<>'[TESTE] Recibo' then raise exception 'Recibo não preservado ou duplicado'; end if;
 if (select count(*) from public.payment_receipts where request_id=request)<>1 then raise exception 'Emissão duplicada'; end if;
 begin
  perform public.admin_issue_payment_receipt(body||jsonb_build_object('request_id',gen_random_uuid(),'paid_on',current_date+2));
  raise exception 'Data futura aceita';
 exception when raise_exception then if sqlerrm not like 'Informe uma data de pagamento%' then raise; end if;
 end;
 begin
  perform public.admin_issue_payment_receipt(body||jsonb_build_object('request_id',gen_random_uuid(),'project_id',gen_random_uuid()));
  raise exception 'Projeto sem vínculo aceito';
 exception when raise_exception then if sqlerrm not like 'Selecione um projeto pertencente%' then raise; end if;
 end;
 if has_table_privilege('authenticated','public.payment_receipts','INSERT') or has_table_privilege('authenticated','public.payment_receipts','UPDATE') or has_table_privilege('anon','public.payment_receipts','SELECT') then raise exception 'Recibos expostos ou mutáveis'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
  perform public.admin_issue_payment_receipt(body);
  raise exception 'Cliente conseguiu emitir';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.payment_receipts) then raise exception 'Cliente conseguiu ler recibos administrativos'; end if;
 begin
  perform public.admin_client_email_status(); raise exception 'Cliente conseguiu ler fila';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: emissão, número único, idempotência, data, vínculo e isolamento administrativo.' as result;
