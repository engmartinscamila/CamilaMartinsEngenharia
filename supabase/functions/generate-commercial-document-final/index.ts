import { createClient } from 'supabase';
import JSZip from 'jszip';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
type Obj = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '').trim();
const isOther = (item: Obj) => ['p', 'outro', 'outros'].includes(text(item.code).toLowerCase());
// Snapshots antigos podem conter levelApplicable=true indevidamente para serviços
// que não são projetos; o Contrato Mestre restringe níveis aos projetos (1.7).
const nonProjectServiceCodes = new Set(['k', 'l', 'm', 'n', 'o', 'p', 'q']);
const isProjectTierEligible = (item: Obj) => item.levelApplicable === true && !nonProjectServiceCodes.has(text(item.code).toLowerCase());
const xmlEsc = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
const wordParagraph = (value: string, bold = false) => `<w:p><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/></w:rPr><w:t xml:space="preserve">${xmlEsc(value)}</w:t></w:r></w:p>`;
const customScopeDescription = (specification: string) => `Atividade específica solicitada: ${specification}. A prestação abrange exclusivamente esta atividade e os resultados expressamente descritos e aprovados no orçamento e no Anexo I. Quantidades, formato de entrega, visitas, revisões, prazo e etapas somente serão considerados incluídos quando definidos expressamente; acréscimos exigem aprovação e contratação prévias.`;
function selectedServices(services: unknown) {
  return Array.isArray(services) ? services.filter(item => item && typeof item === 'object' && (item as Obj).included !== false) as Obj[] : [];
}
function contractScopeXml(services: unknown, customService: unknown, experienceLevel: unknown, propertyAddress: string) {
  const selected = selectedServices(services);
  if (!selected.length && !text(customService)) return '';
  const parts = [
    wordParagraph('ESCOPO TÉCNICO CONTRATADO', true),
    wordParagraph(`Local do serviço / endereço do imóvel ou obra: ${propertyAddress}.`),
  ];
  // Não exibe "nível não selecionado" nem aplica Bronze/Prata/Ouro a consultoria.
  // Em contratação mista, o nível qualifica exclusivamente os projetos elegíveis.
  if (text(experienceLevel) && selected.some(isProjectTierEligible)) {
    parts.push(wordParagraph(`Nível de prestação: ${text(experienceLevel).toUpperCase()}, aplicável exclusivamente aos serviços de projeto elegíveis expressamente contratados. Não acrescenta serviços, visitas, aprovações, execução, taxas, fornecimentos ou entregáveis de outra categoria.`));
  }
  const otherSelected = selected.some(isOther);
  selected.forEach((item, index) => {
    const other = isOther(item);
    const name = other ? 'Serviço técnico personalizado' : text(item.name) || `Serviço ${index + 1}`;
    const description = other && text(customService)
      ? customScopeDescription(text(customService))
      : text(item.description) || 'Serviço técnico conforme o escopo expressamente contratado e detalhado no Anexo I.';
    parts.push(wordParagraph(`${index + 1}. ${name}`, true), wordParagraph(description));
  });
  if (text(customService) && !otherSelected) {
    parts.push(wordParagraph('Serviço adicional / especificação complementar', true));
    parts.push(wordParagraph(text(customService)));
    parts.push(wordParagraph('Este item fica restrito às atividades, entregáveis, premissas e condições expressamente descritas no orçamento e no Anexo I. Qualquer ampliação depende de aprovação e contratação prévias.'));
  }
  return parts.join('');
}
function insertionBeforeParagraph(xml: string, marker: string) {
  const markerIndex = xml.indexOf(marker);
  if (markerIndex < 0) throw new Error('Marcador do resumo contratual não encontrado no Word.');
  const paragraphs = [...xml.slice(0, markerIndex).matchAll(/<w:p(?=[\s>])/g)];
  const start = paragraphs.at(-1)?.index;
  if (start === undefined) throw new Error('Não foi possível localizar um parágrafo válido para o escopo do contrato.');
  return start;
}
async function enhanceContractDocument(bytes: Uint8Array, propertyAddress: string, services: unknown, customService: unknown, experienceLevel: unknown) {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('O contrato gerado não contém o documento Word esperado.');
  let xml = await file.async('string');
  // Nunca substituir o endereço cadastral do contratante no preâmbulo.
  const scopeXml = contractScopeXml(services, customService, experienceLevel, propertyAddress);
  if (scopeXml) {
    const insertion = insertionBeforeParagraph(xml, 'RESUMO COMERCIAL VINCULADO');
    xml = xml.slice(0, insertion) + scopeXml + xml.slice(insertion);
  }
  zip.file('word/document.xml', xml);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

function paragraphText(paragraph: string) {
  return [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('');
}
/** Corrige apenas parágrafos conhecidos e preserva outros conteúdos e estilos do Word. */
async function enhanceQuoteDocument(bytes: Uint8Array, services: unknown, customService: unknown) {
  const selected = selectedServices(services);
  const specification = text(customService);
  const otherSelected = selected.some(isOther);
  const onlyNonProject = selected.length > 0 && selected.every(item => !isProjectTierEligible(item));
  const legacyConsultancy = selected.some(item => text(item.code).toLowerCase() === 'q');
  if ((!otherSelected || !specification) && !onlyNonProject && !legacyConsultancy) return bytes;
  const zip = await JSZip.loadAsync(bytes);
  const word = zip.file('word/document.xml');
  if (!word) throw new Error('O orçamento gerado não contém o documento Word esperado.');
  const xml = await word.async('string');
  const paragraphPattern = /<w:p(?=[\s>])[\s\S]*?<\/w:p>/g;
  const paragraphs = [...xml.matchAll(paragraphPattern)];
  const values = paragraphs.map(match => paragraphText(match[0]));
  const replacement = new Map<number, string>();
  if (otherSelected && specification) {
    const otherHeadingIndex = values.findIndex(value => /^\d+\. (Outro|Serviço técnico personalizado)$/.test(value));
    if (otherHeadingIndex < 0) throw new Error('O serviço personalizado não foi identificado no orçamento gerado.');
    const descriptionIndex = otherHeadingIndex + 1;
    if (descriptionIndex >= values.length) throw new Error('Descrição personalizada ausente no orçamento gerado.');
    replacement.set(descriptionIndex, wordParagraph(customScopeDescription(specification)));
    for (let index = descriptionIndex + 1; index < values.length && index < descriptionIndex + 12; index += 1) {
      if (values[index].startsWith('Revisões incluídas:')) {
        replacement.set(index, wordParagraph('Revisões, formato de entrega e prazo desta atividade: somente os que forem discriminados no escopo específico e no Anexo I; nenhum pacote adicional é presumido.'));
        break;
      }
      if (/^\d+\. /.test(values[index]) || values[index].includes('LIMITES E EXCLUSÕES')) break;
    }
    const duplicateIndex = values.findIndex(value => value === 'Serviço adicional descrito no orçamento');
    if (duplicateIndex >= 0) {
      if (!values[duplicateIndex + 2]?.startsWith('Este item somente integra o escopo')) {
        throw new Error('Bloco personalizado duplicado em formato inesperado; emissão interrompida para evitar conteúdo incorreto.');
      }
      replacement.set(duplicateIndex, '');
      replacement.set(duplicateIndex + 1, '');
      replacement.set(duplicateIndex + 2, '');
    }
  }
  // Os registros antigos de Consultoria têm metadados 2 revisões/PDF/nível;
  // o catálogo novo não regrava snapshots emitidos, então saneamos apenas o Word novo.
  if (legacyConsultancy) {
    values.forEach((value, index) => {
      if (!/^\d+\. Consultoria Técnica$/.test(value)) return;
      for (let next = index + 1; next < values.length && next < index + 12; next += 1) {
        if (values[next].startsWith('Revisões incluídas:')) {
          replacement.set(next, wordParagraph('Revisões, formato de entrega e prazo da consultoria: somente conforme condições expressas no orçamento e no Anexo I.'));
          break;
        }
        if (/^\d+\. /.test(values[next]) || values[next].includes('LIMITES E EXCLUSÕES')) break;
      }
    });
  }
  if (onlyNonProject) {
    values.forEach((value, index) => {
      if (value.startsWith('Na ausência de indicação específica no Anexo I, aplicam-se até 2')) {
        replacement.set(index, wordParagraph('Para os serviços selecionados, o regime de revisões e as condições de aceite devem ser definidos por atividade no Anexo I. Não se presumem rodadas de alterações de escopo para consultorias, vistorias ou atividades personalizadas; correções técnicas seguem o contrato.'));
      }
      if (value.startsWith('O prazo geral de referência é de 45')) {
        replacement.set(index, wordParagraph('O prazo técnico de cada serviço será definido no cronograma aprovado no Anexo I, conforme sua natureza e os insumos necessários. Prazos de análise de órgãos públicos ou terceiros não são prazos de elaboração técnica.'));
      }
    });
  }
  if (!replacement.size) return bytes;
  let output = '';
  let cursor = 0;
  paragraphs.forEach((match, index) => {
    const start = match.index ?? 0;
    output += xml.slice(cursor, start);
    output += replacement.has(index) ? replacement.get(index) : match[0];
    cursor = start + match[0].length;
  });
  output += xml.slice(cursor);
  if (otherSelected && specification && output.includes('Serviço adicional descrito no orçamento')) {
    throw new Error('Orçamento contém bloco personalizado duplicado após revisão.');
  }
  zip.file('word/document.xml', output);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
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
  try {
    const { authorization, url, anonKey, service, user } = await requireAdmin(req);
    const body = await req.json() as Obj;
    const recordId = text(body.recordId);
    const kind = body.kind === 'contrato' ? 'contrato' : 'orcamento';
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) return json({ error: 'Registro comercial inválido.' }, 400);
    const source = await service.from('commercial_records').select('*').eq('id', recordId).maybeSingle();
    if (source.error) throw source.error;
    if (!source.data) return json({ error: 'Registro comercial não encontrado.' }, 404);
    if (kind === 'contrato' && !text(source.data.property_address)) return json({ error: 'Informe o endereço do imóvel / obra antes de gerar o contrato.' }, 422);
    const selected = selectedServices(source.data.services);
    if (!selected.length && !text(source.data.custom_service)) return json({ error: 'Nenhuma atividade foi selecionada para este documento.' }, 422);
    if (selected.some(isOther) && text(source.data.custom_service).length < 12) {
      return json({ error: 'Descreva a atividade Outros com pelo menos 12 caracteres antes de gerar o documento.' }, 422);
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
            version_bump: body.versionBump === 'major' ? 'major' : 'minor', version_reason: reason },
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
      ? await enhanceContractDocument(originalBytes, source.data.property_address, source.data.services, source.data.custom_service, source.data.experience_level)
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
    await service.from('audit_log').insert({ user_id: user.id, action: 'finalize_commercial_document_version', entity_type: 'commercial_records', entity_id: recordId,
      details: { document_id: documentId, document_kind: kind, version: doc.data.versao,
        version_reason: doc.data.version_reason || text(body.versionReason) || null,
        used_property_address: kind === 'contrato', contract_scope_texts_injected: kind === 'contrato',
        same_as_party_address: text(source.data.address) === text(source.data.property_address) } });
    return json({ ...core.data, documentId, version: doc.data.versao,
      addressUsed: kind === 'contrato' ? 'party_and_property_separate' : null,
      scopeTextsInjected: kind === 'contrato', quoteScopeReconciled: kind === 'orcamento' && selected.some(isOther), snapshotFrozen: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível finalizar o documento comercial.';
    return json({ error: message }, message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : 500);
  }
});