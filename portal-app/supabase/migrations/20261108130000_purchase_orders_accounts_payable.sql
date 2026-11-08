-- D04 (decisão de 08/11): proposta aprovada → PEDIDO DE COMPRA (compromisso)
-- → CONTAS A PAGAR no Financeiro. Referência funcional: fluxo de suprimentos
-- de Sienge/Vobi/ERPNext, implementação própria.
--
-- Regras:
--  * um pedido por cotação aprovada; valor = proposta escolhida (centavos exatos);
--  * as parcelas viram lançamentos `financeiro` tipo 'saida', status 'pendente',
--    categoria 'compras', vinculados ao pedido — a única fonte já usada pelo
--    Financeiro e pelo Controle de custos (nada é contado duas vezes);
--  * reenvio com a mesma chave devolve o mesmo pedido (idempotente);
--  * cancelamento só sem parcela paga; parcelas pendentes ficam 'cancelado'
--    (nada é apagado);
--  * parcela de pedido não muda valor, tipo, projeto nem vínculo e não é excluída.
-- Aditiva e idempotente.

create sequence if not exists public.purchase_order_number_seq;

create table if not exists public.purchase_orders(
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  quote_id uuid not null unique references public.purchase_quotes(id) on delete restrict,
  bid_id uuid not null references public.supplier_bids(id) on delete restrict,
  project_id uuid not null references public.projetos(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount > 0),
  payment_terms text,
  expected_delivery date,
  notes text,
  status text not null default 'emitido' check (status in ('emitido','recebido','cancelado')),
  received_on date,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  request_id uuid not null unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_orders_project_idx on public.purchase_orders(project_id);
alter table public.purchase_orders enable row level security;
drop policy if exists purchase_orders_admin_read on public.purchase_orders;
create policy purchase_orders_admin_read on public.purchase_orders
  for select to authenticated using (public.is_portal_admin());
revoke insert, update, delete on public.purchase_orders from anon, authenticated;
grant select on public.purchase_orders to authenticated;

alter table public.financeiro
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete restrict;
create index if not exists financeiro_purchase_order_idx on public.financeiro(purchase_order_id) where purchase_order_id is not null;

create or replace function private.guard_purchase_payable()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op='DELETE' then
    if old.purchase_order_id is not null then
      raise exception 'Parcela de pedido de compra não é excluída; cancele o pedido.' using errcode='P0001', hint='purchase_payable_locked';
    end if;
    return old;
  end if;
  if tg_op='INSERT' then
    if new.purchase_order_id is not null and coalesce(current_setting('cme.purchase_order_write',true),'')<>'on' then
      raise exception 'Vínculo com pedido de compra só é criado pelo próprio pedido.' using errcode='P0001', hint='purchase_payable_locked';
    end if;
    return new;
  end if;
  if old.purchase_order_id is not null and (
       new.purchase_order_id is distinct from old.purchase_order_id
    or new.valor is distinct from old.valor
    or new.tipo is distinct from old.tipo
    or new.projeto_id is distinct from old.projeto_id
  ) then
    raise exception 'Parcela de pedido de compra: valor, tipo, projeto e vínculo são definidos pelo pedido.' using errcode='P0001', hint='purchase_payable_locked';
  end if;
  if old.purchase_order_id is null and new.purchase_order_id is not null
     and coalesce(current_setting('cme.purchase_order_write',true),'')<>'on' then
    raise exception 'Vínculo com pedido de compra só é criado pelo próprio pedido.' using errcode='P0001', hint='purchase_payable_locked';
  end if;
  return new;
end
$function$;

drop trigger if exists a02_guard_purchase_payable on public.financeiro;
create trigger a02_guard_purchase_payable
  before insert or update or delete on public.financeiro
  for each row execute function private.guard_purchase_payable();

create or replace function public.admin_create_purchase_order(
  p_quote_id uuid,
  p_request_id uuid,
  p_installments jsonb,
  p_expected_delivery date default null,
  p_notes text default null
)
returns public.purchase_orders
language plpgsql
security definer
set search_path to ''
as $function$
declare
  q public.purchase_quotes;
  b public.supplier_bids;
  s public.suppliers;
  o public.purchase_orders;
  v_count integer;
  v_sum numeric;
  v_item jsonb;
  v_index integer:=0;
  v_due date;
  v_amount numeric;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode='42501';
  end if;
  if p_quote_id is null or p_request_id is null then
    raise exception 'Identifique a cotação e a solicitação.';
  end if;

  select * into o from public.purchase_orders where request_id=p_request_id;
  if found then
    if o.quote_id<>p_quote_id then raise exception 'A solicitação já pertence a outro pedido.'; end if;
    return o;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('purchase-order:'||p_quote_id::text,0));
  select * into o from public.purchase_orders where quote_id=p_quote_id;
  if found then raise exception 'Esta cotação já possui o pedido %.', o.order_number; end if;

  select * into q from public.purchase_quotes where id=p_quote_id for update;
  if not found then raise exception 'Cotação não encontrada.'; end if;
  if q.status<>'approved' or q.selected_supplier_id is null then
    raise exception 'Aprove a proposta de um fornecedor antes de emitir o pedido.';
  end if;
  select * into b from public.supplier_bids where quote_id=q.id and supplier_id=q.selected_supplier_id;
  if not found or b.total_amount is null or b.total_amount<=0 then
    raise exception 'A proposta aprovada precisa ter valor total positivo.';
  end if;
  select * into s from public.suppliers where id=b.supplier_id;

  if jsonb_typeof(p_installments) is distinct from 'array' then
    raise exception 'Informe as parcelas do pedido.';
  end if;
  select count(*), sum((i->>'amount')::numeric) into v_count, v_sum from jsonb_array_elements(p_installments) i;
  if v_count<1 or v_count>60 then raise exception 'Informe de 1 a 60 parcelas.'; end if;
  if exists(select 1 from jsonb_array_elements(p_installments) i
            where (i->>'amount') is null or (i->>'amount')::numeric<=0
               or (i->>'amount')::numeric<>round((i->>'amount')::numeric,2)
               or (i->>'due_date') is null) then
    raise exception 'Cada parcela precisa de valor positivo com até 2 casas e vencimento.';
  end if;
  if v_sum<>b.total_amount then
    raise exception 'A soma das parcelas (%) deve ser igual ao valor da proposta aprovada (%).', v_sum, b.total_amount;
  end if;

  insert into public.purchase_orders(order_number,quote_id,bid_id,project_id,supplier_id,total_amount,payment_terms,
    expected_delivery,notes,request_id,created_by)
  values('PC-'||lpad(nextval('public.purchase_order_number_seq')::text,6,'0'),q.id,b.id,q.project_id,b.supplier_id,b.total_amount,
    b.payment_terms,p_expected_delivery,nullif(btrim(coalesce(p_notes,'')),''),p_request_id,auth.uid())
  returning * into o;

  perform set_config('cme.purchase_order_write','on',true);
  for v_item in select value from jsonb_array_elements(p_installments) order by (value->>'due_date')::date loop
    v_index:=v_index+1;
    v_due:=(v_item->>'due_date')::date;
    v_amount:=(v_item->>'amount')::numeric;
    insert into public.financeiro(projeto_id,descricao,tipo,valor,data,status,data_vencimento,categoria,source,observacoes,purchase_order_id)
    values(q.project_id,
      o.order_number||' — '||coalesce(s.name,'Fornecedor')||' — '||q.title||' — parcela '||v_index||'/'||v_count,
      'saida',v_amount,v_due,'pendente',v_due,'compras','purchase_order',
      'Conta a pagar gerada pelo pedido '||o.order_number||' (cotação '||q.id::text||').',o.id);
  end loop;
  perform set_config('cme.purchase_order_write','off',true);

  update public.purchase_quotes set status='ordered', updated_at=now() where id=q.id;
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'create_purchase_order','purchase_orders',o.id,
    jsonb_build_object('order_number',o.order_number,'quote_id',q.id,'supplier_id',b.supplier_id,'total',b.total_amount,'installments',v_count));
  return o;
end
$function$;

create or replace function public.admin_mark_purchase_order_received(p_order_id uuid, p_received_on date)
returns public.purchase_orders
language plpgsql
security definer
set search_path to ''
as $function$
declare o public.purchase_orders;
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode='42501';
  end if;
  select * into o from public.purchase_orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status='recebido' then return o; end if;
  if o.status<>'emitido' then raise exception 'Somente pedido emitido pode ser recebido.'; end if;
  if p_received_on is null or p_received_on>(now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe a data de recebimento já ocorrida.';
  end if;
  update public.purchase_orders set status='recebido', received_on=p_received_on, updated_at=now()
   where id=o.id returning * into o;
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'receive_purchase_order','purchase_orders',o.id,jsonb_build_object('received_on',p_received_on));
  return o;
end
$function$;

create or replace function public.admin_cancel_purchase_order(p_order_id uuid, p_reason text)
returns public.purchase_orders
language plpgsql
security definer
set search_path to ''
as $function$
declare o public.purchase_orders; v_reason text:=btrim(coalesce(p_reason,''));
begin
  if auth.uid() is null or not public.is_portal_admin() then
    raise exception 'Acesso administrativo necessário.' using errcode='42501';
  end if;
  if length(v_reason)<5 then raise exception 'Descreva o motivo do cancelamento (mínimo de 5 caracteres).'; end if;
  select * into o from public.purchase_orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status='cancelado' then return o; end if;
  if exists(select 1 from public.financeiro where purchase_order_id=o.id and status='pago') then
    raise exception 'O pedido tem parcela paga; registre a devolução/estorno no Financeiro antes de cancelar.';
  end if;
  update public.financeiro set status='cancelado',
    observacoes=coalesce(observacoes,'')||' Cancelado com o pedido '||o.order_number||': '||v_reason
   where purchase_order_id=o.id and status<>'cancelado';
  update public.purchase_orders set status='cancelado', cancelled_at=now(), cancelled_by=auth.uid(), cancel_reason=v_reason, updated_at=now()
   where id=o.id returning * into o;
  insert into public.audit_log(user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'cancel_purchase_order','purchase_orders',o.id,jsonb_build_object('reason',v_reason));
  return o;
end
$function$;

revoke all on function public.admin_create_purchase_order(uuid,uuid,jsonb,date,text) from public,anon;
revoke all on function public.admin_mark_purchase_order_received(uuid,date) from public,anon;
revoke all on function public.admin_cancel_purchase_order(uuid,text) from public,anon;
revoke all on function private.guard_purchase_payable() from public,anon,authenticated;
grant execute on function public.admin_create_purchase_order(uuid,uuid,jsonb,date,text) to authenticated;
grant execute on function public.admin_mark_purchase_order_received(uuid,date) to authenticated;
grant execute on function public.admin_cancel_purchase_order(uuid,text) to authenticated;
