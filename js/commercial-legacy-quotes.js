/* Consulta de fontes legadas de orçamentos de projetos. */
(function(){'use strict';
  function buildProjectAddress(project) {
    return [
      project.endereco_obra,
      project.numero_obra,
      project.complemento_obra,
      project.bairro_obra,
      project.cidade_obra,
      project.estado_obra,
      project.cep_obra ? `CEP ${project.cep_obra}` : ''
    ].filter(Boolean).join(', ');
  }

  async function loadLegacyQuoteSources(projects, client) {
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
        linked_client_id: project.cliente_id || null,
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


window.CMECommercialLegacyQuotes={buildProjectAddress,loadLegacyQuoteSources};
}());
