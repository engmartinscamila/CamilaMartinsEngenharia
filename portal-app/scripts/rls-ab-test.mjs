import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'TEST_CLIENT_A_EMAIL',
  'TEST_CLIENT_A_PASSWORD',
  'TEST_CLIENT_B_EMAIL',
  'TEST_CLIENT_B_PASSWORD',
];

for (const key of required) assert.ok(process.env[key], `Variável ausente: ${key}`);

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(anonKey, 'Variável ausente: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
assert.ok(!anonKey.startsWith('sb_secret_'), 'Use somente a chave Publishable no teste.');
const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client();
const clientA = client();
const clientB = client();

async function login(instance, email, password, label) {
  const { data, error } = await instance.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.user, `${label} não autenticou`);
}

async function ownContext(instance, label) {
  const [clientsResult, projectsResult] = await Promise.all([
    instance.from('clientes').select('id, email'),
    instance.from('projetos').select('id, cliente_id'),
  ]);
  assert.ifError(clientsResult.error);
  assert.ifError(projectsResult.error);
  assert.equal(clientsResult.data.length, 1, `${label} deve visualizar apenas seu cadastro`);
  assert.ok(projectsResult.data.length > 0, `${label} precisa ter pelo menos um projeto de teste`);
  assert.ok(projectsResult.data.every((project) => project.cliente_id === clientsResult.data[0].id));
  return { clientId: clientsResult.data[0].id, projects: projectsResult.data };
}

async function visibleProjectIds(instance, table) {
  const { data, error } = await instance.from(table).select('projeto_id');
  assert.ifError(error);
  return (data ?? []).map((row) => row.projeto_id).filter(Boolean);
}

let insertedRequestId = null;
try {
  await Promise.all([
    login(admin, process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, 'Administrador'),
    login(clientA, process.env.TEST_CLIENT_A_EMAIL, process.env.TEST_CLIENT_A_PASSWORD, 'Cliente A'),
    login(clientB, process.env.TEST_CLIENT_B_EMAIL, process.env.TEST_CLIENT_B_PASSWORD, 'Cliente B'),
  ]);

  const [contextA, contextB] = await Promise.all([ownContext(clientA, 'Cliente A'), ownContext(clientB, 'Cliente B')]);
  const idsA = new Set(contextA.projects.map((project) => project.id));
  const idsB = new Set(contextB.projects.map((project) => project.id));
  assert.ok([...idsA].every((id) => !idsB.has(id)), 'Clientes A e B não podem compartilhar o mesmo projeto neste teste');

  const { data: forbiddenProject, error: forbiddenError } = await clientA
    .from('projetos')
    .select('id')
    .eq('id', contextB.projects[0].id);
  assert.ifError(forbiddenError);
  assert.equal(forbiddenProject.length, 0, 'Cliente A conseguiu ler o projeto do Cliente B');

  for (const table of ['documentos', 'fotos', 'agenda', 'cronograma', 'solicitacoes', 'aprovacoes']) {
    const visibleIds = await visibleProjectIds(clientA, table);
    assert.ok(visibleIds.every((id) => idsA.has(id)), `Cliente A recebeu linha indevida em ${table}`);
  }

  for (const table of ['financeiro', 'extrato_financeiro', 'client_financial_archive']) {
    const { data, error } = await clientA.from(table).select('*').limit(5);
    assert.ifError(error);
    assert.equal(data.length, 0, `Cliente A conseguiu ler a área financeira ${table}`);
  }
  for (const table of ['financeiro', 'extrato_financeiro', 'client_financial_archive']) {
    const { error } = await admin.from(table).select('*').limit(1);
    assert.ifError(error);
  }

  const { data: createdRequest, error: createError } = await clientA
    .from('solicitacoes')
    .insert({
      cliente_id: contextA.clientId,
      projeto_id: contextA.projects[0].id,
      titulo: 'Teste automático A/B',
      mensagem: 'Registro temporário para validar isolamento RLS.',
      origem: 'cliente',
      status: 'nova',
    })
    .select('id')
    .single();
  assert.ifError(createError);
  insertedRequestId = createdRequest.id;

  const { data: leakedRequest, error: leakedRequestError } = await clientB
    .from('solicitacoes')
    .select('id')
    .eq('id', insertedRequestId);
  assert.ifError(leakedRequestError);
  assert.equal(leakedRequest.length, 0, 'Cliente B conseguiu ler a solicitação do Cliente A');

  const { data: adminClients, error: adminClientsError } = await admin.from('clientes').select('id').in('id', [contextA.clientId, contextB.clientId]);
  assert.ifError(adminClientsError);
  assert.equal(adminClients.length, 2, 'Administrador não visualiza os dois clientes');

  const { data: bDocument, error: bDocumentError } = await admin
    .from('documentos')
    .select('id, storage_bucket, arquivo')
    .eq('projeto_id', contextB.projects[0].id)
    .not('arquivo', 'is', null)
    .limit(1)
    .maybeSingle();
  assert.ifError(bDocumentError);
  if (bDocument?.arquivo) {
    const { data: signedData, error: signedError } = await clientA.storage
      .from(bDocument.storage_bucket ?? 'documentos')
      .createSignedUrl(bDocument.arquivo, 60);
    assert.ok(signedError || !signedData?.signedUrl, 'Cliente A obteve URL do arquivo do Cliente B');
    const issued = await clientA.functions.invoke('issue-protected-asset', {
      body: { assetId: bDocument.id, kind: 'document', action: 'view' },
    });
    assert.ok(issued.error || !issued.data?.url, 'Cliente A emitiu cópia protegida do Cliente B');
  }

  process.stdout.write('APROVADO: isolamento Administrador / Cliente A / Cliente B validado.\n');
} finally {
  if (insertedRequestId) {
    const { error } = await admin.from('solicitacoes').delete().eq('id', insertedRequestId);
    if (error) console.error('ATENÇÃO: remova a solicitação temporária:', insertedRequestId);
  }
  await Promise.all([admin.auth.signOut(), clientA.auth.signOut(), clientB.auth.signOut()]);
}
