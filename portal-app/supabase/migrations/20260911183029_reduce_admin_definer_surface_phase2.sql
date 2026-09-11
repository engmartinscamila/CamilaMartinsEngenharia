alter function public.admin_client_deletion_preview(uuid) security invoker;
alter function public.admin_confirm_document_rule_review(uuid) security invoker;
alter function public.admin_create_contract_project_v2(uuid,text,text,text,numeric,text,text) security invoker;
alter function public.admin_create_project_for_contract(uuid,text,text,text) security invoker;
alter function public.admin_create_request(uuid,uuid,text,text,text) security invoker;
alter function public.admin_initialize_construction_schedule(uuid) security invoker;
alter function public.admin_set_client_status(uuid,text) security invoker;
alter function public.admin_update_contract_value(uuid,numeric) security invoker;
