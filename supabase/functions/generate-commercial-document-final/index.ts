import { createClient } from 'supabase';
import { enhanceContractDocument, enhanceQuoteDocument, selectedServices } from '../_shared/commercial-word-enhancements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
type Obj = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '').trim();
const isOther = (item: Obj) => ['p', 'outro', 'outros'].includes(text(item.code).toLowerCase());
// A elegibilidade vem do snapshot versionado; serviços avulsos também podem ter pacote.
// Não recalcular contratos históricos usando códigos fixos.
function env() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('Configuração segura ausente.');
  return { url, anonKey, serviceKey };
}
async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const { url, anonKey, serviceKey } = env();
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return { authorization, url, anonKey, service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), user: userData.user };
}
async function proxyCore(url: string, anonKey: string, authorization: string, body: unknown) {
  const response = await fetch(`${url}/functions/v1/generate-commercial-document`, {
    method: 'POST', headers: { Authorization: authorization, apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let data: Obj = {};
  try { data = await response.json(); } catch { data = { error: 'Resposta inválida do gerador comercial principal.' }; }
  return { response, data };
}
async function sha256(value: unknown) {
  const raw = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  let createdRevisionId: string | null = null;
  let previousDocumentId: string | null = null;
  let pointerField = '';
  let cleanup: { service: any; recordId: string } | null = null;
  try {
    const { authorization, url, anonKey, service, user } = await requireAdmin(req);
    const body = await req.json() as Obj;
    const recordId = text(body.recordId);
    const kind = body.kind === 'contrato' ? 'contrato' : 'orcamento';
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) return json({ error: 'Registro comercial inválido.' }, 400);
    cleanup={service,recordId};
    const preparedScope = await service.rpc('admin_prepare_commercial_scope_for_generation', { p_record_id: recordId });
    if (preparedScope.error) throw preparedScope.error;
    const source = await service.from('commercial_records').select('*').eq('id', recordId).maybeSingle();
    if (source.error) throw source.error;
    if (!source.data) return json({ error: 'Registro comercial não encontrado.' }, 404);
    if (kind === 'contrato' && !text(source.data.property_address)) return json({ error: 'Informe o endereço do imóvel / obra antes de gerar o contrato.' }, 422);
    const selected = selectedServices(source.data.services);
    if (!selected.length && !text(source.data.custom_service)) return json({ error: 'Nenhuma atividade foi selecionada para este documento.' }, 422);
    if (selected.some(isOther) && text(source.data.custom_service).length < 12) {
      return json({ error: 'Descreva a atividade Outros com pelo menos 12 caracteres antes de gerar o documento.' }, 422);
    }
    if (kind === 'contrato') {
      // Bloqueio de classificações contraditórias: não transformar um serviço do catálogo
      // em outra atividade apenas porque a ficha possui entregáveis de natureza distinta.
      const terms = source.data.commercial_terms && typeof source.data.commercial_terms === 'object'
        ? source.data.commercial_terms as Obj : {};
      const scope = Array.isArray(terms.scope) ? terms.scope as Obj[] : [];
      for (const item of selected) {
        const code = text(item.code).toLowerCase();
        const row = scope.find(entry => text(entry.code).toLowerCase() === code);
        const deliverables = text(row?.deliverables).toLowerCase();
        const normalized = deliverables.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!normalized) return json({error: 'Preencha os entregáveis específicos do serviço '+text(item.name)+' antes de emitir.'},422);
        const waterSystems = normalized.replace(/\b(?:sem|nao inclui|nao contempla|nao abrange|exclui)\b[^,.;\n]*(?:esgoto|hidrossanit)[^,.;\n]*/g, '');
        if (code === 'am' && /hidrossanit|esgoto/.test(waterSystems)) {
          return json({error: 'Inconsistência na classificação: Projeto Hidráulico contempla somente água, mas os entregáveis incluem esgoto. Reclassifique como Projeto Hidrossanitário antes de emitir.'},422);
        }
        if (code === 'aj' && /projeto.*hidraulico|projeto.*hidrossanitario/.test(normalized) &&
            !/rede externa|rede publica|saneamento externo|rede de abastecimento/.test(normalized)) {
          return json({error: 'Inconsistência na classificação: Projeto de Saneamento / Redes de Água e Esgoto foi associado a pranchas de instalações prediais hidráulicas e hidrossanitárias. Corrija a atividade para Projeto Hidrossanitário Predial ou ajuste os entregáveis ao serviço realmente contratado antes de emitir.'},422);
        }
        if (code === 'u' && /elaboracao de projeto arquitetonico|projeto arquitetonico para projeto executivo/.test(normalized) &&
            !/levantamento geometrico|levantamento cadastral|medicao cadastral/.test(normalized)) {
          return json({error: 'Inconsistência na classificação: Levantamento Técnico / Cadastral possui entregáveis de elaboração de projeto arquitetônico/maquete. Corrija a seleção da atividade ou descreva os produtos específicos do levantamento antes de emitir.'},422);
        }
      }
    }
    pointerField = kind === 'contrato' ? 'contract_document_id' : 'quote_document_id';
    previousDocumentId = text(source.data[pointerField]) || null;
    if (previousDocumentId) {
      const frozen = await service.from('document_emission_snapshots').select('id').eq('document_id', previousDocumentId).maybeSingle();
      if (frozen.error) throw frozen.error;
      if (frozen.data) {
        const reason = text(body.versionReason);
        if (!reason) return json({ error: 'Informe o motivo da nova versão antes de gerar novamente.' }, 422);
        const old = await service.from('documentos').select('*').eq('id', previousDocumentId).single();
        if (old.error) throw old.error;
        const oldPath = text(old.data.arquivo);
        // Download sem arquivamento remove o arquivo; arquivo arquivado usa caminho próprio.
        const number = kind === 'orcamento' ? text(source.data.quote_number) : text(source.data.contract_number) || 'contrato';
        const overwrittenPath = `comercial/${recordId}/${kind}-${number}-v1.0.docx`;
        if (oldPath && oldPath === overwrittenPath) {
          const oldBucket = text(old.data.storage_bucket) || 'documentos';
          const oldDownload = await service.storage.from(oldBucket).download(oldPath);
          if (oldDownload.error || !oldDownload.data) throw oldDownload.error ?? new Error('Não foi possível preservar o Word anterior.');
          const backupPath = `comercial/${recordId}/historico/${previousDocumentId}-${kind}.docx`;
          const backupUpload = await service.storage.from(oldBucket).upload(backupPath, new Uint8Array(await oldDownload.data.arrayBuffer()), {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false,
          });
          if (backupUpload.error) throw backupUpload.error;
          const preserved = await service.from('documentos').update({ arquivo: backupPath }).eq('id', previousDocumentId);
          if (preserved.error) throw preserved.error;
        }
        const oldData = old.data.generated_data && typeof old.data.generated_data === 'object' ? old.data.generated_data as Obj : {};
        const inserted = await service.from('documentos').insert({
          cliente_id: old.data.cliente_id, projeto_id: old.data.projeto_id, contract_id: old.data.contract_id,
          approval_id: old.data.approval_id, nome: old.data.nome, tipo: old.data.tipo, categoria: old.data.categoria || 'Comercial',
          versao: '1.0', storage_bucket: old.data.storage_bucket || 'documentos', permitir_download: old.data.permitir_download !== false,
          protection_mode: old.data.protection_mode || 'administrative', autoral: old.data.autoral === true,
          document_kind: kind, workflow_status: 'rascunho', optional_document: old.data.optional_document === true,
          generated_data: { ...oldData, commercial_document_kind: kind, commercial_record_id: recordId,
            version_bump: 'major', version_reason: reason },
        }).select('id,versao').single();
        if (inserted.error) throw inserted.error;
        createdRevisionId = inserted.data.id;
        const linked = await service.from('commercial_records').update({ [pointerField]: createdRevisionId }).eq('id', recordId);
        if (linked.error) throw linked.error;
      }
    }
    const core = await proxyCore(url, anonKey, authorization, { recordId, kind });
    if (!core.response.ok) {
      if (createdRevisionId && previousDocumentId) {
        await service.from('commercial_records').update({ [pointerField]: previousDocumentId }).eq('id', recordId);
        await service.from('documentos').delete().eq('id', createdRevisionId);
      }
      return json(core.data, core.response.status);
    }
    const documentId = text(core.data.documentId);
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error('Documento comercial gerado sem vínculo documental válido.');
    const doc = await service.from('documentos').select('id,arquivo,storage_bucket,generated_data,versao,version_reason,document_kind').eq('id', documentId).single();
    if (doc.error) throw doc.error;
    if (!doc.data.arquivo) throw new Error('O documento foi preparado sem arquivo Word.');
    const bucket = doc.data.storage_bucket || 'documentos';
    const downloaded = await service.storage.from(bucket).download(doc.data.arquivo);
    if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error('Não foi possível abrir o documento recém-gerado.');
    const originalBytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const finalBytes = kind === 'contrato'
      ? await enhanceContractDocument(originalBytes, source.data.property_address, source.data.services, source.data.custom_service, source.data.experience_level, source.data.commercial_terms)
      : await enhanceQuoteDocument(originalBytes, source.data.services, source.data.custom_service);
    if (finalBytes !== originalBytes) {
      const uploaded = await service.storage.from(bucket).upload(doc.data.arquivo, finalBytes, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true,
      });
      if (uploaded.error) throw uploaded.error;
    }
    const generatedData = doc.data.generated_data && typeof doc.data.generated_data === 'object' ? doc.data.generated_data as Obj : {};
    const finalData = { ...generatedData, commercial_record_snapshot: source.data, property_address: source.data.property_address,
      party_address: source.data.address, address_used_in_contract: kind === 'contrato' ? 'party_and_property_separate' : undefined,
      contract_scope_texts_injected: kind === 'contrato', quote_custom_scope_reconciled: kind === 'orcamento' && selected.some(isOther),
      version_reason: doc.data.version_reason || text(body.versionReason) || null };
    const updated = await service.from('documentos').update({ generated_data: finalData, snapshot_frozen_at: new Date().toISOString() }).eq('id', documentId);
    if (updated.error) throw updated.error;
    const snapshot = { ...finalData, document_id: documentId, document_kind: kind, version: doc.data.versao };
    const snap = await service.from('document_emission_snapshots').insert({ document_id: documentId, document_kind: kind,
      version: doc.data.versao || '1.0', version_reason: doc.data.version_reason || text(body.versionReason) || null,
      snapshot, snapshot_hash: await sha256(snapshot), emitted_at: new Date().toISOString(), created_by: user.id });
    if (snap.error && !String(snap.error.message || '').toLowerCase().includes('duplicate')) throw snap.error;
    const issuedPath=`_issued_word/${documentId}.docx`;
    const retained=await service.storage.from(bucket).upload(issuedPath,finalBytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false});
    if(retained.error && !String(retained.error.message||'').toLowerCase().includes('already exists'))throw retained.error;
    const kept=await service.from('documentos').update({arquivo:issuedPath,archived_explicitly:true,archived_storage_size:finalBytes.byteLength}).eq('id',documentId);if(kept.error)throw kept.error;
    const history=await service.from('document_generation_history').select('id').eq('document_id',documentId).limit(1).maybeSingle();if(history.error)throw history.error;
    if(!history.data){const saved=await service.from('document_generation_history').insert({document_id:documentId,document_kind:kind,document_name:kind==='contrato'?`Contrato ${source.data.contract_number} — ${source.data.prospect_name}`:`Orçamento ${source.data.quote_number} — ${source.data.prospect_name}`,document_number:kind==='contrato'?source.data.contract_number:source.data.quote_number,version:doc.data.versao,workflow_status:'gerado',client_id:source.data.linked_client_id||null,project_id:source.data.linked_project_id||null,contract_id:source.data.linked_contract_id||null,commercial_record_id:recordId,party_name:source.data.prospect_name,storage_mode:'archived',archive_path:issuedPath,file_size_bytes:finalBytes.byteLength,generated_by:user.id,generated_at:core.data.emittedAt||new Date().toISOString()});if(saved.error)throw saved.error;}
    await service.from('audit_log').insert({ user_id: user.id, action: 'finalize_commercial_document_version', entity_type: 'commercial_records', entity_id: recordId,
      details: { document_id: documentId, document_kind: kind, version: doc.data.versao,
        version_reason: doc.data.version_reason || text(body.versionReason) || null,
        used_property_address: kind === 'contrato', contract_scope_texts_injected: kind === 'contrato',
        same_as_party_address: text(source.data.address) === text(source.data.property_address) } });
    return json({ ...core.data, documentId, version: doc.data.versao,
      addressUsed: kind === 'contrato' ? 'party_and_property_separate' : null,
      scopeTextsInjected: kind === 'contrato', quoteScopeReconciled: kind === 'orcamento' && selected.some(isOther), snapshotFrozen: true }, 200);
  } catch (error) {
    if(cleanup&&createdRevisionId&&previousDocumentId){
      const state=await cleanup.service.from('documentos').select('workflow_status,generated_at').eq('id',createdRevisionId).maybeSingle();
      const frozen=await cleanup.service.from('document_emission_snapshots').select('id').eq('document_id',createdRevisionId).maybeSingle();
      if(!state.error&&!frozen.error&&!frozen.data&&state.data?.workflow_status==='rascunho'&&!state.data.generated_at){
        const restored=await cleanup.service.from('commercial_records').update({[pointerField]:previousDocumentId}).eq('id',cleanup.recordId).eq(pointerField,createdRevisionId);
        if(!restored.error)await cleanup.service.from('documentos').delete().eq('id',createdRevisionId).eq('workflow_status','rascunho');
      }
    }
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || 'Não foi possível finalizar o documento comercial.');
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});