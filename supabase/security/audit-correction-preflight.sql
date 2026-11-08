-- Read only: zero counts are required before applying the candidate guards.
-- Do not repair historical business data automatically if any count is nonzero.
select jsonb_build_object(
 'financial_origin_conflicts',(
   select count(*) from public.financeiro f
   left join public.projetos p on p.id=f.projeto_id
   left join public.contratos c on c.id=f.contract_id
   where (f.projeto_id is not null and p.id is null)
     or (f.contract_id is not null and c.id is null)
     or (f.cliente_id is not null and p.id is not null and f.cliente_id is distinct from p.cliente_id)
     or (f.cliente_id is not null and c.id is not null and f.cliente_id is distinct from c.cliente_id)
     or (p.id is not null and c.id is not null and p.cliente_id is distinct from c.cliente_id)
     or (p.contract_id is not null and f.contract_id is not null and p.contract_id is distinct from f.contract_id)
     or coalesce(f.cliente_id,p.cliente_id,c.cliente_id) is null
 ),
 'receipt_equivalence_conflicts',(
   select count(*) from public.payment_receipts r
   left join public.financeiro f on f.id=r.financial_entry_id
   left join public.projetos p on p.id=f.projeto_id
   where f.id is null or f.tipo is distinct from 'entrada'
     or lower(coalesce(f.status,'')) not in ('pago','recebido','quitado')
     or f.valor is distinct from r.amount
     or coalesce(f.data_pagamento,f.data) is distinct from r.paid_on
     or f.projeto_id is distinct from r.project_id
     or coalesce(f.cliente_id,p.cliente_id) is distinct from r.client_id
     or trim(f.descricao) is distinct from r.description
 ),
 'cross_project_dependencies',(
   select count(*) from public.project_task_dependencies d
   join public.project_tasks t on t.id=d.task_id
   join public.project_tasks p on p.id=d.depends_on_task_id
   where t.project_id is distinct from p.project_id
 ),
 'cross_project_parents',(
   select count(*) from public.project_tasks t join public.project_tasks p on p.id=t.parent_task_id
   where t.project_id is distinct from p.project_id
 ),
 'dependency_cycles',(
   with recursive paths(start_id,next_id) as (
     select task_id,depends_on_task_id from public.project_task_dependencies
     union
     select p.start_id,d.depends_on_task_id from paths p join public.project_task_dependencies d on d.task_id=p.next_id
   ) select count(*) from paths where start_id=next_id
 ),
 'parent_cycles',(
   with recursive paths(start_id,next_id) as (
     select id,parent_task_id from public.project_tasks where parent_task_id is not null
     union
     select p.start_id,t.parent_task_id from paths p join public.project_tasks t on t.id=p.next_id where t.parent_task_id is not null
   ) select count(*) from paths where start_id=next_id
 )
) candidate_preflight;
