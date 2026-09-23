import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../../supabase/migrations/20260922232000_reutilizar_cliente_existente_orcamento.sql',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../../portal-app/src/services/commercial-service.ts',import.meta.url),'utf8');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks+=1;};

ok(/admin_search_existing_clients/i.test(migration),'migração cria busca de clientes');
ok(/security invoker/i.test(migration),'funções novas não usam SECURITY DEFINER');
ok(/if not public\.is_portal_admin\(\)/i.test(migration),'busca e criação exigem administradora');
ok(/revoke all on function public\.admin_search_existing_clients\([^)]+\) from public, anon/i.test(migration),'anon/public não recebem EXECUTE');
ok(/admin_create_commercial_record_from_client/i.test(migration),'wrapper de criação existe');
ok(/linked_client_id\s*=\s*p_client_id/i.test(migration),'novo orçamento registra vínculo do cliente');
ok(!/update\s+public\.clientes/i.test(migration),'fluxo não atualiza silenciosamente cadastro do cliente');
ok(/client_record_changed'\s*,\s*false/i.test(migration),'auditoria registra preservação do cliente');
ok(/searchExistingCommercialClients/i.test(service),'aplicativo usa busca controlada');
ok(/linkedClientId[\s\S]*admin_create_commercial_record_from_client/i.test(service),'aplicativo chama wrapper somente quando cliente foi explicitamente selecionado');

console.log(`REUSO DE CLIENTE: ${checks} verificações defensivas passaram.`);
