(function () {
  'use strict';

  let servicesCatalog = [
    ['a', 'Estudo Preliminar'],
    ['b', 'Anteprojeto'],
    ['c', 'Projeto Legal'],
    ['d', 'Projeto Executivo / detalhamento'],
    ['e', 'Projeto Estrutural'],
    ['f', 'Projeto Elétrico'],
    ['g', 'Projeto Hidrossanitário'],
    ['h', 'Projeto de Interiores'],
    ['i', 'Paisagismo'],
    ['j', 'Render 3D / Maquete eletrônica'],
    ['k', 'Legalização / Aprovação Prefeitura'],
    ['l', 'Alvará de Construção'],
    ['m', 'Habite-se'],
    ['n', 'Acompanhamento técnico de obra'],
    ['o', 'Laudo técnico / avaliação / vistoria'],
    ['p', 'Outro']
  ];
  let serviceCatalogMeta = [];
  let levelCatalog = [];

  const $ = id => document.getElementById(id);
  const client = () => window.supabaseClient;
  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const digits = value => String(value || '').replace(/\D/g, '');

  let rows = [];
  let quoteSources = [];

  const mode = () => location.hash === '#contrato' ? 'contrato' : 'orcamento';

  function msg(text, type = '') {
    const element = $('commercialMessage');
    if (!element) return;
    element.textContent = text;
    element.className = `doc-status ${type}`;
  }

  function b64blob(base64, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  function download(base64, name) {
    const url = URL.createObjectURL(b64blob(base64));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name || 'documento.docx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function renderServices() {
    const box = $('commercialServices');
    if (!box) return;
    const levelNames = levelCatalog
      .map(item => String(item.label || item.code || '').trim())
      .filter(Boolean)
      .join(' / ');

    box.innerHTML = servicesCatalog.map(([code, name]) => {
      const meta = serviceCatalogMeta.find(item => item.code === code) || {};
      const detail = meta.description
        ? `<small class="doc-service-description">${esc(meta.description)}</small>`
        : '';
      const level = meta.level_applicable
        ? `<small class="doc-service-level">Compatível com ${esc(levelNames || 'os níveis cadastrados')}</small>`
        : '<small class="doc-service-level muted">Serviço independente de nível</small>';

      return `
        <label class="doc-service doc-service-smart">
          <input type="checkbox" data-service="${code}">
          <span>
            <strong>(${code}) ${esc(name)}</strong>
            ${detail}
            ${level}
          </span>
        </label>
      `;
    }).join('');
  }

  function ensureLevelInfo() {
    const select = $('experienceLevel');
    if (!select || $('experienceLevelInfo')) return;
    const info = document.createElement('div');
    info.id = 'experienceLevelInfo';
    info.className = 'doc-status doc-level-info';
    select.closest('.doc-field')?.appendChild(info);
    select.addEventListener('change', renderLevelInfo);
  }

  function renderLevelOptions() {
    const select = $('experienceLevel');
    if (!select) return;

    const current = String(select.value || '').trim().toLowerCase();
    const levelOrder = { bronze: 10, prata: 20, ouro: 30 };
    const orderedLevels = [...levelCatalog].sort((a, b) =>
      (levelOrder[a.code] ?? 100) - (levelOrder[b.code] ?? 100) ||
      String(a.label || a.code).localeCompare(String(b.label || b.code), 'pt-BR')
    );

    const options = ['<option value="">Selecione</option>'].concat(
      orderedLevels.map(level =>
        `<option value="${esc(level.code)}">${esc(level.label)} — ${esc(level.subtitle || 'Personalizado')}</option>`
      )
    );

    select.innerHTML = options.join('');

    if (current && levelCatalog.some(level => level.code === current)) {
      select.value = current;
    }
  }

  function renderLevelInfo() {
    const info = $('experienceLevelInfo');
    const selected = String($('experienceLevel')?.value || '').trim().toLowerCase();

    if (!info) return;
    if (!selected) {
      info.textContent = 'Selecione um nível apenas para serviços de projeto elegíveis. Projetos complementares, aprovações, visitas e execução permanecem independentes.';
      return;
    }

    const level = levelCatalog.find(item => item.code === selected);
    if (!level) {
      info.textContent = 'O nível selecionado será aplicado somente aos serviços elegíveis e não incluirá serviços técnicos que não tenham sido marcados.';
      return;
    }

    const features = Array.isArray(level.features) ? level.features.join(' • ') : '';
    info.textContent = `${level.label} — ${level.subtitle}: ${level.description}${features ? ' Principais recursos: ' + features + '.' : ''}`;
  }

  function form() {
    const services = servicesCatalog.map(([code, name], index) => ({
      code,
      name,
      included: Boolean(document.querySelector(`[data-service="${code}"]`)?.checked),
      acceptanceRequired: true,
      displayOrder: index + 1
    }));

    return {
      prospect_name: $('prospectName').value.trim(),
      cpf_cnpj: $('cpfCnpj').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim(),
      cep: $('cep').value.trim(),
      address: $('address').value.trim(),
      city: $('city').value.trim(),
      state: $('state').value.trim(),
      property_address: $('propertyAddress').value.trim(),
      property_type: $('propertyType').value.trim(),
      area_terreno_m2: $('areaTerreno').value.trim(),
      area_construida_m2: $('areaConstruida').value.trim(),
      construction_standard: $('constructionStandard').value.trim(),
      experience_level: $('experienceLevel').value.trim(),
      services,
      custom_service: $('customService').value.trim(),
      total_value: $('totalValue').value.trim(),
      notes: $('notes').value.trim()
    };
  }

  async function lookup(kind) {
    const field = kind === 'cnpj' ? $('cpfCnpj') : $('cep');
    const value = digits(field.value);

    if ((kind === 'cnpj' && value.length !== 14) || (kind === 'cep' && value.length !== 8)) {
      msg(kind === 'cnpj'
        ? 'Informe um CNPJ com 14 dígitos. CPF permanece manual.'
        : 'Informe um CEP com 8 dígitos.', 'error');
      return;
    }

    msg('Consultando...');
    const { data, error } = await client().functions.invoke('lookup-commercial-data', {
      body: { kind, value }
    });

    if (error || !data?.data) {
      msg(data?.error || error?.message || 'Consulta não disponível.', 'error');
      return;
    }

    const result = data.data;
    if (kind === 'cnpj') {
      $('prospectName').value = result.legalName || $('prospectName').value;
      $('cpfCnpj').value = result.cnpj || $('cpfCnpj').value;
      $('email').value = result.email || $('email').value;
      $('phone').value = result.phone || $('phone').value;
      $('cep').value = result.cep || $('cep').value;
    }

    $('address').value = result.address || $('address').value;
    $('city').value = result.city || $('city').value;
    $('state').value = result.state || $('state').value;
    msg('Dados preenchidos. Revise antes de continuar.', 'success');
  }

  function ensureContractSource() {
    if ($('contractQuoteSources')) return;

    const panel = $('panelCommercialCreate');
    const grid = panel?.querySelector('.doc-grid');
    if (!panel || !grid) return;

    const box = document.createElement('div');
    box.id = 'contractQuoteSources';
    box.className = 'doc-contract-source doc-hidden';
    box.innerHTML = `
      <div class="doc-field">
        <label for="contractQuoteSelect">Vincular a orçamento existente</label>
        <select id="contractQuoteSelect">
          <option value="">Selecione o número do orçamento (opcional)</option>
        </select>
      </div>
      <div id="contractQuoteSummary" class="doc-status doc-hidden" aria-live="polite"></div>
    `;

    panel.insertBefore(box, grid);
    $('contractQuoteSelect')?.addEventListener('change', event => applyQuoteToContract(event.target.value));
  }

  function renderMode() {
    ensureContractSource();
    const isContract = mode() === 'contrato';

    $('contractQuoteSources')?.classList.toggle('doc-hidden', !isContract);

    if ($('createCommercial')) {
      $('createCommercial').textContent = isContract ? 'Criar contrato CON' : 'Criar orçamento ORC';
    }

    const card = $('panelCommercialCreate');
    if (card) {
      const title = card.querySelector('h3');
      if (title) title.textContent = isContract ? 'Dados do contratante' : 'Dados do prospect';

      const description = card.querySelector('p');
      if (description) {
        description.textContent = isContract
          ? 'Selecione o número de um orçamento existente para preencher os dados automaticamente, ou deixe sem seleção para criar o contrato manualmente.'
          : 'O orçamento pode ser criado mesmo sem cliente cadastrado.';
      }
    }

    renderQuoteChoices();
    renderList();
  }

  function renderQuoteChoices() {
    const select = $('contractQuoteSelect');
    if (!select) return;

    const current = select.value;
    const commercial = quoteSources.filter(item => item.sourceType === 'commercial');
    const projects = quoteSources.filter(item => item.sourceType === 'project');

    let html = '<option value="">Selecione o número do orçamento (opcional)</option>';

    if (commercial.length) {
      html += '<optgroup label="Orçamentos da central">';
      html += commercial.map(item =>
        `<option value="${esc(item.key)}">${esc(item.quote_number)} — ${esc(item.prospect_name || 'Sem nome')}${item.property_type ? ' • ' + esc(item.property_type) : ''}</option>`
      ).join('');
      html += '</optgroup>';
    }

    if (projects.length) {
      html += '<optgroup label="Orçamentos já cadastrados">';
      html += projects.map(item =>
        `<option value="${esc(item.key)}">${esc(item.quote_number)} — ${esc(item.prospect_name || item.project_name || 'Sem nome')}${item.project_name ? ' • ' + esc(item.project_name) : ''}</option>`
      ).join('');
      html += '</optgroup>';
    }

    select.innerHTML = html;

    if (current && quoteSources.some(item => item.key === current)) {
      select.value = current;
    }
  }

  function clearForm(clearSource = true) {
    [
      'prospectName', 'cpfCnpj', 'email', 'phone', 'cep', 'address', 'city', 'state',
      'propertyAddress', 'propertyType', 'constructionStandard', 'areaTerreno',
      'areaConstruida', 'customService', 'totalValue', 'notes'
    ].forEach(id => {
      if ($(id)) $(id).value = '';
    });

    if ($('experienceLevel')) $('experienceLevel').value = '';
    document.querySelectorAll('[data-service]').forEach(input => { input.checked = false; });

    if (clearSource && $('contractQuoteSelect')) $('contractQuoteSelect').value = '';

    const summary = $('contractQuoteSummary');
    if (summary) {
      summary.textContent = '';
      summary.classList.add('doc-hidden');
    }
  }

  function setField(id, value) {
    const element = $(id);
    if (element) element.value = value ?? '';
  }

  function moneyValue(value) {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value);
  }

  function applyServices(services) {
    document.querySelectorAll('[data-service]').forEach(input => { input.checked = false; });
    (Array.isArray(services) ? services : []).forEach(item => {
      const code = String(item?.code || '');
      const input = document.querySelector(`[data-service="${CSS.escape(code)}"]`);
      if (input) input.checked = item?.included === true;
    });
  }

  function applyQuoteToContract(key) {
    const summary = $('contractQuoteSummary');

    if (!key) {
      clearForm(false);
      msg('Sem orçamento selecionado: o contrato poderá ser preenchido manualmente.');
      return;
    }

    const quote = quoteSources.find(item => item.key === key);
    if (!quote) {
      msg('Orçamento selecionado não foi encontrado.', 'error');
      return;
    }

    setField('prospectName', quote.prospect_name);
    setField('cpfCnpj', quote.cpf_cnpj);
    setField('email', quote.email);
    setField('phone', quote.phone);
    setField('cep', quote.cep);
    setField('address', quote.address);
    setField('city', quote.city);
    setField('state', quote.state);
    setField('propertyAddress', quote.property_address);
    setField('propertyType', quote.property_type);
    setField('constructionStandard', quote.construction_standard);
    setField('areaTerreno', quote.area_terreno_m2);
    setField('areaConstruida', quote.area_construida_m2);
    setField('customService', quote.custom_service);
    setField('totalValue', moneyValue(quote.total_value));
    setField('notes', quote.notes);

    if ($('experienceLevel')) $('experienceLevel').value = quote.experience_level || '';
    applyServices(quote.services);

    if (summary) {
      summary.textContent = `${quote.quote_number} selecionado. Os dados disponíveis foram carregados automaticamente e continuam editáveis.`;
      summary.className = 'doc-status success';
    }

    msg(`Orçamento ${quote.quote_number} vinculado ao contrato.`, 'success');
  }

  async function create() {
    const payload = form();
    const isContract = mode() === 'contrato';

    if (!payload.prospect_name) {
      msg('Informe o nome / razão social.', 'error');
      return;
    }

    const selectedServices = payload.services.filter(item => item.included);
    if (!selectedServices.length && !payload.custom_service) {
      msg('Selecione ao menos um serviço ou descreva outro serviço.', 'error');
      return;
    }

    if (serviceCatalogMeta.length) {
      const selectedCodes = new Set(selectedServices.map(item => item.code));
      const hasLevelEligibleService = serviceCatalogMeta.some(item =>
        selectedCodes.has(item.code) && item.level_applicable === true
      );
      if (hasLevelEligibleService && !payload.experience_level) {
        msg('Selecione o nível de prestação para os serviços compatíveis escolhidos.', 'error');
        return;
      }
      if (!hasLevelEligibleService && payload.experience_level) {
        msg('O nível de prestação só pode ser usado quando houver um serviço compatível selecionado.', 'error');
        return;
      }
    }

    const selectedKey = $('contractQuoteSelect')?.value || '';
    const source = quoteSources.find(item => item.key === selectedKey) || null;
    const quoteIds = source?.sourceType === 'commercial' ? [source.sourceId] : [];
    const sourceProjectId = source?.sourceType === 'project' ? source.sourceId : null;

    msg(isContract ? 'Criando contrato...' : 'Criando orçamento...');

    const result = isContract
      ? await client().rpc('admin_create_independent_contract', {
          p_data: payload,
          p_quote_ids: quoteIds,
          p_source_project_id: sourceProjectId
        })
      : await client().rpc('admin_create_commercial_record', { p_data: payload });

    if (result.error || !result.data) {
      msg(result.error?.message || `Não foi possível criar o ${isContract ? 'contrato' : 'orçamento'}.`, 'error');
      return;
    }

    clearForm();
    msg(
      isContract
        ? (source ? `Contrato criado e vinculado ao orçamento ${source.quote_number}.` : 'Contrato criado sem vínculo de orçamento.')
        : 'Orçamento criado com numeração ORC independente.',
      'success'
    );

    await load();
  }

  async function generate(recordId, kind, archive) {
    msg(`Gerando ${kind}...`);
    const generated = await client().functions.invoke('generate-commercial-document', {
      body: { recordId, kind }
    });

    if (generated.error || !generated.data?.generated) {
      msg(generated.data?.error || generated.error?.message || 'Não foi possível gerar o Word.', 'error');
      return;
    }

    const documentId = generated.data.documentId;
    if (!documentId) {
      msg('Documento gerado sem vínculo de entrega.', 'error');
      return;
    }

    const delivered = await client().functions.invoke('deliver-generated-document', {
      body: { documentId, archive, expectedDocumentKind: kind }
    });

    if (delivered.error || !delivered.data?.delivered || delivered.data?.documentKind !== kind) {
      msg(delivered.data?.error || delivered.error?.message || 'Não foi possível preparar o download.', 'error');
      return;
    }

    download(delivered.data.contentBase64, delivered.data.fileName);
    msg(archive ? 'Word baixado e arquivado no sistema.' : 'Word baixado e extrato preservado.', 'success');
    await load();
  }

  async function convert(id) {
    if (!confirm('Formalizar este contrato criando/vinculando cliente e projeto?')) return;

    msg('Formalizando contrato...');
    const { data, error } = await client().rpc('admin_convert_commercial_record', {
      p_record_id: id
    });

    if (error || !data) {
      msg(error?.message || 'Não foi possível formalizar.', 'error');
      return;
    }

    msg('Contrato formalizado e vinculado ao cliente/projeto.', 'success');
    await load();
  }

  function renderList() {
    const box = $('commercialList');
    if (!box) return;

    const kind = mode();
    const data = rows.filter(record => (record.record_kind || 'orcamento') === kind);
    const title = $('commercialExistingTitle');
    if (title) title.textContent = kind === 'contrato' ? 'Contratos' : 'Orçamentos';

    if (!data.length) {
      box.innerHTML = `<p>Nenhum ${kind === 'contrato' ? 'contrato' : 'orçamento'} criado nesta central.</p>`;
      return;
    }

    box.innerHTML = data.map(record => {
      const number = kind === 'contrato' ? record.contract_number : record.quote_number;
      const origin = record.source_quote_number
        ? ` • origem: ${esc(record.source_quote_number)}`
        : '';

      const actions = kind === 'contrato'
        ? `<button class="doc-btn secondary" data-action="contract" data-id="${record.id}">Baixar contrato</button>
           <button class="doc-btn ghost" data-action="contract-archive" data-id="${record.id}">Baixar + arquivar</button>
           <button class="doc-btn" data-action="convert" data-id="${record.id}" ${record.status === 'convertido' ? 'disabled' : ''}>
             ${record.status === 'convertido' ? 'Cliente/projeto vinculados' : 'Formalizar cliente + projeto'}
           </button>`
        : `<button class="doc-btn secondary" data-action="quote" data-id="${record.id}">Baixar orçamento</button>
           <button class="doc-btn ghost" data-action="quote-archive" data-id="${record.id}">Baixar + arquivar</button>`;

      return `
        <div class="doc-row">
          <div class="doc-row-head">
            <div>
              <strong>${esc(number)} • ${esc(record.prospect_name)}</strong>
              <div class="doc-meta">
                ${esc(record.property_type || 'Serviço de engenharia')} •
                ${new Date(record.created_at).toLocaleDateString('pt-BR')}${origin}
              </div>
            </div>
            <span class="doc-badge">${esc(String(record.status || '').replaceAll('_', ' '))}</span>
          </div>
          <div class="doc-actions">${actions}</div>
        </div>
      `;
    }).join('');
  }

  function buildProjectAddress(project) {
    return [
      project.endereco_obra,
      project.numero_obra,
      project.complemento_obra,
      project.bairro_obra,
      project.cidade_obra,
      project.estado_obra
    ].filter(Boolean).join(', ');
  }

  async function loadLegacyQuoteSources(projects) {
    const projectRows = (projects || []).filter(project => String(project.numero_orcamento || '').trim());
    if (!projectRows.length) return [];

    const clientIds = [...new Set(projectRows.map(project => project.cliente_id).filter(Boolean))];
    const contractIds = [...new Set(projectRows.map(project => project.contract_id).filter(Boolean))];

    const [clientsRes, contractsRes, scopesRes] = await Promise.all([
      clientIds.length
        ? client().from('clientes').select('id,nome,cpf_cnpj,telefone,email,endereco,cidade,estado,cep').in('id', clientIds)
        : Promise.resolve({ data: [], error: null }),
      contractIds.length
        ? client().from('contratos').select('id,contract_number,contract_value,service_type,notes').in('id', contractIds)
        : Promise.resolve({ data: [], error: null }),
      contractIds.length
        ? client().from('contract_scope_items').select('contract_id,service_code,service_name,included,acceptance_required,display_order,notes').in('contract_id', contractIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (clientsRes.error || contractsRes.error || scopesRes.error) {
      console.warn('Alguns dados auxiliares dos orçamentos antigos não puderam ser carregados.');
    }

    const clientsById = new Map((clientsRes.data || []).map(item => [item.id, item]));
    const contractsById = new Map((contractsRes.data || []).map(item => [item.id, item]));
    const scopesByContract = new Map();

    (scopesRes.data || []).forEach(item => {
      if (!scopesByContract.has(item.contract_id)) scopesByContract.set(item.contract_id, []);
      scopesByContract.get(item.contract_id).push({
        code: item.service_code,
        name: item.service_name,
        included: item.included === true,
        acceptanceRequired: item.acceptance_required !== false,
        displayOrder: item.display_order || 0,
        notes: item.notes || ''
      });
    });

    return projectRows.map(project => {
      const owner = clientsById.get(project.cliente_id) || {};
      const contract = contractsById.get(project.contract_id) || {};
      return {
        key: `project:${project.id}`,
        sourceType: 'project',
        sourceId: project.id,
        quote_number: project.numero_orcamento,
        project_name: project.nome,
        prospect_name: owner.nome || project.nome,
        cpf_cnpj: owner.cpf_cnpj || '',
        email: owner.email || '',
        phone: owner.telefone || '',
        cep: project.cep_obra || owner.cep || '',
        address: owner.endereco || '',
        city: project.cidade_obra || owner.cidade || '',
        state: project.estado_obra || owner.estado || '',
        property_address: buildProjectAddress(project),
        property_type: project.tipo || contract.service_type || '',
        area_terreno_m2: project.area_terreno_m2 ?? '',
        area_construida_m2: project.area_construida_m2 ?? '',
        construction_standard: '',
        experience_level: '',
        services: scopesByContract.get(project.contract_id) || [],
        custom_service: '',
        total_value: contract.contract_value ?? '',
        notes: contract.notes || ''
      };
    });
  }

  async function load() {
    const [recordsRes, projectsRes, servicesRes, levelsRes] = await Promise.all([
      client().from('commercial_records')
        .select('id,quote_number,contract_number,record_kind,source_mode,status,prospect_name,cpf_cnpj,email,phone,cep,address,city,state,property_address,property_type,area_terreno_m2,area_construida_m2,construction_standard,experience_level,services,custom_service,total_value,payment_terms,valid_until,notes,quote_document_id,contract_document_id,source_project_id,created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      client().from('projetos')
        .select('id,nome,tipo,status,cliente_id,numero_orcamento,numero_contrato,contract_id,area_construida_m2,area_terreno_m2,cep_obra,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra,created_at')
        .not('numero_orcamento', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
      client().from('service_catalog')
        .select('code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,default_revisions,delivery_formats,planning_reference,version')
        .eq('active', true)
        .order('code'),
      client().from('service_level_catalog')
        .select('code,label,subtitle,description,features,exclusions,version')
        .eq('active', true)
        .order('code')
    ]);

    if (recordsRes.error) {
      msg('Não foi possível carregar o histórico comercial.', 'error');
      return;
    }

    rows = recordsRes.data || [];

    if (!servicesRes.error && Array.isArray(servicesRes.data) && servicesRes.data.length) {
      serviceCatalogMeta = servicesRes.data;
      servicesCatalog = serviceCatalogMeta.map(item => [item.code, item.name]);
      renderServices();
    }

    if (!levelsRes.error && Array.isArray(levelsRes.data)) {
      levelCatalog = levelsRes.data;
      renderLevelOptions();
      renderServices();
    }

    ensureLevelInfo();
    renderLevelInfo();

    const legacySources = projectsRes.error ? [] : await loadLegacyQuoteSources(projectsRes.data || []);

    const centralSources = rows
      .filter(record => (record.record_kind || 'orcamento') === 'orcamento')
      .map(record => ({
        ...record,
        key: `commercial:${record.id}`,
        sourceType: 'commercial',
        sourceId: record.id
      }));

    quoteSources = [...centralSources, ...legacySources]
      .filter((item, index, list) =>
        index === list.findIndex(other => other.quote_number === item.quote_number)
      )
      .sort((a, b) => String(b.quote_number || '').localeCompare(String(a.quote_number || ''), 'pt-BR'));

    rows = rows.map(record => {
      const sourceProject = legacySources.find(item => item.sourceId === record.source_project_id);
      return {
        ...record,
        source_quote_number: sourceProject?.quote_number || null
      };
    });

    renderMode();
  }

  function bind() {
    renderServices();
    ensureLevelInfo();
    renderLevelOptions();
    renderLevelInfo();
    ensureContractSource();

    $('lookupCnpj')?.addEventListener('click', () => lookup('cnpj'));
    $('lookupCep')?.addEventListener('click', () => lookup('cep'));
    $('createCommercial')?.addEventListener('click', create);

    $('commercialList')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === 'quote') generate(id, 'orcamento', false);
      if (action === 'quote-archive') generate(id, 'orcamento', true);
      if (action === 'contract') generate(id, 'contrato', false);
      if (action === 'contract-archive') generate(id, 'contrato', true);
      if (action === 'convert') convert(id);
    });

    window.addEventListener('hashchange', renderMode);
    document.querySelectorAll('[data-doc-tab]').forEach(button => {
      button.addEventListener('click', () => setTimeout(renderMode, 0));
    });

    setTimeout(load, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
