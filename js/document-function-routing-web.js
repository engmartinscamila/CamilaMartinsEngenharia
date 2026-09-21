(function () {
  'use strict';

  const isOther = code => ['p', 'outro', 'outros'].includes(String(code || '').toLowerCase().trim());
  const read = id => document.getElementById(id);
  const showError = message => {
    const status = read('commercialMessage');
    if (status) {
      status.textContent = message;
      status.className = 'doc-status error';
    }
  };

  // Captura anterior ao clique do formulário original; impede inserir um ORC/CON
  // com "Outros" selecionado sem descrição identificável.
  function validateCommercialCreation(event) {
    const button = event.target?.closest?.('#createCommercial');
    if (!button) return;
    const custom = String(read('customService')?.value || '').trim();
    const other = document.querySelector('#commercialServices [data-service="p"]');
    if (custom && other) other.checked = true;
    const selected = Array.from(document.querySelectorAll('#commercialServices [data-service]')).filter(item => item.checked);
    let error = '';
    if (!selected.length && !custom) error = 'Selecione uma atividade ou descreva um serviço personalizado.';
    else if ((other?.checked || custom) && (custom.length < 12 || /^(outro|outros|a definir|servi[cç]o t[eé]cnico)$/i.test(custom))) {
      error = 'Para Outros, descreva o serviço concreto com pelo menos 12 caracteres. O texto informado será utilizado no orçamento e no contrato.';
    }
    if (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showError(error);
      read('customService')?.focus();
    }
  }

  function canceled(message) {
    return { data: { generated: false, error: message }, error: null };
  }

  async function confirmCommercialDocument(client, options) {
    const payload = options?.body || {};
    const recordId = String(payload.recordId || '');
    const kind = payload.kind === 'contrato' ? 'contrato' : 'orcamento';
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) return { error: 'Registro comercial inválido.' };

    const lookup = await client.from('commercial_records')
      .select('prospect_name,address,property_address,services,custom_service,total_value,quote_number,contract_number,quote_document_id,contract_document_id')
      .eq('id', recordId).maybeSingle();
    if (lookup.error || !lookup.data) return { error: 'Não foi possível conferir os dados do orçamento ou contrato antes da emissão.' };
    const record = lookup.data;
    if (kind === 'contrato' && !String(record.property_address || '').trim()) {
      return { error: 'Informe o endereço do imóvel/obra antes de gerar o contrato; ele não será confundido com o endereço cadastral.' };
    }
    const selected = (Array.isArray(record.services) ? record.services : [])
      .filter(item => item && item.included !== false);
    const other = selected.some(item => isOther(item.code));
    if (other && String(record.custom_service || '').trim().length < 12) {
      return { error: 'O escopo de Outros está incompleto; corrija a descrição antes de emitir o documento.' };
    }
    if (!selected.length && !String(record.custom_service || '').trim()) return { error: 'Nenhum serviço contratado foi encontrado.' };

    const services = selected.map(item => isOther(item.code)
      ? `• Serviço personalizado: ${record.custom_service || 'Descrição ausente'}`
      : `• ${item.name || item.code}`).join('\n');
    const total = record.total_value === null || record.total_value === undefined
      ? 'Não informado' : Number(record.total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const text = [
      `Prévia de ${kind === 'contrato' ? 'CONTRATO' : 'ORÇAMENTO'} — ${kind === 'contrato' ? record.contract_number || 'numeração automática' : record.quote_number}`,
      `Cliente/prospect: ${record.prospect_name}`,
      `Endereço cadastral: ${record.address || 'Não informado'}`,
      `Local da obra/serviço: ${record.property_address || 'Não informado'}`,
      `Valor: ${total}`,
      `Serviços:\n${services || `• ${record.custom_service}`}`,
      'A emissão usará a versão documentada deste escopo. Confira antes de continuar.'
    ].join('\n\n');
    if (!window.confirm(text)) return { error: 'Emissão cancelada antes de criar o Word.' };

    const documentId = kind === 'contrato' ? record.contract_document_id : record.quote_document_id;
    let reason = String(payload.versionReason || '').trim();
    let bump = payload.versionBump === 'major' ? 'major' : 'minor';
    if (documentId) {
      const snapshot = await client.from('document_emission_snapshots').select('id').eq('document_id', documentId).maybeSingle();
      if (snapshot.error) return { error: 'Não foi possível confirmar a versão atual; a emissão foi interrompida para preservar o histórico.' };
      if (snapshot.data) {
        reason = String(window.prompt('Este documento já foi emitido. Informe o motivo da nova versão (obrigatório):', reason) || '').trim();
        if (!reason) return { error: 'Nova emissão cancelada: informe o motivo da revisão para proteger a versão anterior.' };
        bump = window.confirm('Gerar uma nova versão principal? Clique em Cancelar para uma revisão menor.') ? 'major' : 'minor';
      }
    }
    return { body: { ...payload, recordId, kind, versionReason: reason, versionBump: bump } };
  }

  function install() {
    const client = window.supabaseClient;
    if (!client?.functions?.invoke || client.functions.__cmeFinalRouting) return;
    const original = client.functions.invoke.bind(client.functions);
    const routes = {
      'generate-contract-document': 'generate-contract-document-final',
      'generate-commercial-document': 'generate-commercial-document-final'
    };
    const acceptanceKinds = new Set(['anexo_i', 'termo_aceite', 'servico_adicional', 'autorizacao_imagem', 'quitacao_encerramento']);
    document.addEventListener('click', validateCommercialCreation, true);

    client.functions.invoke = async (name, options) => {
      let invokedOptions = options;
      if (name === 'generate-commercial-document') {
        const preview = await confirmCommercialDocument(client, options);
        if (preview.error) return canceled(preview.error);
        invokedOptions = { ...options, body: preview.body };
      }
      const result = await original(routes[name] || name, invokedOptions);
      const body = invokedOptions?.body || {};
      if (name === 'generate-contract-document' && body.action === 'send' && result?.data?.sent && body.documentId) {
        const release = await client.rpc('admin_release_document_for_client', {
          p_document_id: body.documentId,
          p_acceptance_required: acceptanceKinds.has(body.expectedDocumentKind),
          p_valid_from: null,
          p_valid_until: null
        });
        if (release.error) return { ...result, error: release.error, data: { ...(result.data || {}), sent: false, error: release.error.message } };
      }
      return result;
    };
    client.functions.__cmeFinalRouting = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();