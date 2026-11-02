import JSZip from 'jszip';
type Obj=Record<string,unknown>;
const text=(value:unknown)=>String(value??'').trim();
const isOther=(item:Obj)=>['p','outro','outros'].includes(text(item.code).toLowerCase());
const isProjectTierEligible = (item: Obj) => item.levelApplicable === true;
const serviceLevelObject = (item: Obj) => item.level && typeof item.level === 'object' ? item.level as Obj : null;
const serviceLevelCode = (item: Obj) => text(serviceLevelObject(item)?.code ?? item.levelCode).toLowerCase();
const serviceLevelLabel = (item: Obj) => {
  const level = serviceLevelObject(item);
  const label = text(level?.label);
  return label || serviceLevelCode(item).toUpperCase();
};
const xmlEsc = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const sentencePart = (value: unknown) => text(value).replace(/[.!?]+\s*$/u, '');
const wordParagraph = (value: string, bold = false) => `<w:p><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/></w:rPr><w:t xml:space="preserve">${xmlEsc(value)}</w:t></w:r></w:p>`;
const customScopeDescription = (specification: string) => `Atividade específica solicitada: ${specification}. A prestação abrange exclusivamente esta atividade e os resultados expressamente descritos e aprovados no orçamento e no Anexo I. Quantidades, formato de entrega, visitas, revisões, prazo e etapas somente serão considerados incluídos quando definidos expressamente; acréscimos exigem aprovação e contratação prévias.`;
function selectedServices(services: unknown) {
  return Array.isArray(services) ? services.filter(item => item && typeof item === 'object' && (item as Obj).included !== false) as Obj[] : [];
}
function paragraphText(paragraph: string) {
  return [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join('');
}
function contractScopeXml(services: unknown, customService: unknown, experienceLevel: unknown, propertyAddress: string, commercialTerms: unknown) {
  const selected = selectedServices(services);
  if (!selected.length && !text(customService)) return '';
  const terms = commercialTerms && typeof commercialTerms === 'object' ? commercialTerms as Obj : {};
  const specificRows = Array.isArray(terms.scope) ? terms.scope.filter(row => row && typeof row === 'object') as Obj[] : [];
  const perItemLevels = selected.filter(item => isProjectTierEligible(item) && serviceLevelCode(item));
  const distinctLevels = [...new Set(perItemLevels.map(serviceLevelCode))];
  const parts = [
    wordParagraph('ESCOPO TÉCNICO CONTRATADO', true),
    wordParagraph(`Local do serviço / endereço do imóvel ou obra: ${propertyAddress}.`),
  ];
  if (!perItemLevels.length && text(experienceLevel) && selected.some(isProjectTierEligible)) {
    parts.push(wordParagraph(`Nível de prestação: ${text(experienceLevel).toUpperCase()}, aplicável exclusivamente às atividades elegíveis expressamente contratadas. Não acrescenta serviços, visitas, aprovações, execução, taxas, fornecimentos ou entregáveis de outra categoria.`));
  } else if (distinctLevels.length > 1) {
    parts.push(wordParagraph('Os níveis de prestação são definidos individualmente por atividade e não ampliam automaticamente o escopo de outras atividades.'));
  }
  const otherSelected = selected.some(isOther);
  selected.forEach((item, index) => {
    const other = isOther(item);
    const name = other ? 'Serviço técnico personalizado' : text(item.name) || `Serviço ${index + 1}`;
    const row = specificRows.find(entry => text(entry.code).toLowerCase() === text(item.code).toLowerCase());
    const agreed = sentencePart(row?.deliverables);
    if (!row || !agreed) throw new Error(`Preencha os entregáveis específicos de ${name} nas condições comerciais antes de gerar o contrato.`);
    const description = other && text(customService)
      ? `Atividade contratada: ${sentencePart(customService)}. Entrega técnica aprovada: ${agreed}.`
      : `Entrega técnica aprovada para esta atividade: ${agreed}.`;
    parts.push(wordParagraph(`${index + 1}. ${name}`, true));
    if (isProjectTierEligible(item) && serviceLevelCode(item)) {
      parts.push(wordParagraph(`Nível desta atividade: ${serviceLevelLabel(item)}.`));
    }
    parts.push(wordParagraph(description));
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
async function enhanceContractDocument(bytes: Uint8Array, propertyAddress: string, services: unknown, customService: unknown, experienceLevel: unknown, commercialTerms: unknown) {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('O contrato gerado não contém o documento Word esperado.');
  let xml = await file.async('string');
  const selected = selectedServices(services);
  const selectedLevelCodes = [...new Set(selected.filter(isProjectTierEligible).map(serviceLevelCode).filter(Boolean))];
  if (selected.length > 0 && selected.every(item => !isProjectTierEligible(item))) {
    // Snapshot histórico sem nível aplicável: não atribuir pacote retroativamente.
    xml = xml.replace(/<w:p(?=[\s>])[\s\S]*?<\/w:p>/g, paragraph =>
      /^Nível de (experiência|prestação):/.test(paragraphText(paragraph))
        ? wordParagraph('Níveis Bronze/Prata/Ouro: não aplicáveis às atividades desta contratação; prevalece o escopo aprovado no Anexo I.')
        : paragraph);
  } else if (selectedLevelCodes.length > 1) {
    xml = xml.replace(/<w:p(?=[\s>])[\s\S]*?<\/w:p>/g, paragraph =>
      /^Nível de (experiência|prestação):/.test(paragraphText(paragraph))
        ? wordParagraph('Níveis de prestação: definidos individualmente por atividade no escopo técnico vinculado.')
        : paragraph);
  }
  // Não substitui endereço cadastral do contratante no preâmbulo.
  const scopeXml = contractScopeXml(services, customService, experienceLevel, propertyAddress, commercialTerms);
  if (scopeXml) {
    const insertion = insertionBeforeParagraph(xml, 'RESUMO COMERCIAL VINCULADO');
    xml = xml.slice(0, insertion) + scopeXml + xml.slice(insertion);
  }
  zip.file('word/document.xml', xml);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Corrige apenas parágrafos conhecidos e preserva outros conteúdos e estilos do Word. */
async function enhanceQuoteDocument(bytes: Uint8Array, services: unknown, customService: unknown) {
  const selected = selectedServices(services);
  const specification = text(customService);
  const otherSelected = selected.some(isOther);
  const onlyNonProject = selected.length > 0 && selected.every(item => !isProjectTierEligible(item));
  const onlyStandaloneService = selected.length > 0 && selected.every(item => ['j', 'k', 'l', 'm', 'n', 'o', 'p', 'q'].includes(text(item.code).toLowerCase()));
  const legacyConsultancy = selected.some(item => text(item.code).toLowerCase() === 'q');
  if ((!otherSelected || !specification) && !onlyNonProject && !onlyStandaloneService && !legacyConsultancy && selected.every(isProjectTierEligible)) return bytes;
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
    // Elimina recursos, descrições e selo de Bronze/Prata/Ouro impressos pelo
    // gerador principal na seção 2 mesmo em documentos só de consultoria.
    const levelStart = values.findIndex(value => value === '2. NÍVEL DE PRESTAÇÃO DE SERVIÇO');
    const scopeStart = values.findIndex((value, index) => index > levelStart && value === '3. ESCOPO INTELIGENTE DE SERVIÇOS');
    if (levelStart >= 0 && scopeStart > levelStart + 1) {
      replacement.set(levelStart + 1, wordParagraph('O registro anterior não contém pacote válido no snapshot; prevalecem as condições específicas aprovadas no orçamento e no Anexo I, sem atribuição retroativa de nível.'));
      for (let index = levelStart + 2; index < scopeStart; index += 1) replacement.set(index, '');
    }
    values.forEach((value, index) => {
      if (value.startsWith('Na ausência de indicação específica no Anexo I, aplicam-se até 2')) {
        replacement.set(index, wordParagraph('Para os serviços selecionados, o regime de revisões e as condições de aceite devem ser definidos por atividade no Anexo I. Não se presumem rodadas de alterações de escopo para consultorias, vistorias ou atividades personalizadas; correções técnicas seguem o contrato.'));
      }
      if (value.startsWith('O prazo geral de referência é de 45')) {
        replacement.set(index, wordParagraph('O prazo técnico de cada serviço será definido no cronograma aprovado no Anexo I, conforme sua natureza e os insumos necessários. Prazos de análise de órgãos públicos ou terceiros não são prazos de elaboração técnica.'));
      }
    });
  } else if (selected.some(isProjectTierEligible) && selected.some(item => !isProjectTierEligible(item))) {
    // Proposta mista: elimina a indicação indevida de consultoria/serviços
    // administrativos como elegíveis, sem remover nível dos projetos.
    const eligible = selected.filter(isProjectTierEligible).map(item => text(item.name) || text(item.code));
    values.forEach((value, index) => {
      if (value.startsWith('O nível selecionado aplica-se somente aos serviços de projeto elegíveis nesta proposta:')) {
        replacement.set(index, wordParagraph(`O nível selecionado aplica-se exclusivamente aos serviços de projeto elegíveis desta proposta: ${eligible.join(', ')}.`));
      }
    });
  }
  if (onlyStandaloneService && !onlyNonProject) {
    // A contratação avulsa pode ter pacote, mas não herda prazos/revisões de projeto.
    values.forEach((value, index) => {
      if (value.startsWith('Na ausência de indicação específica no Anexo I, aplicam-se até 2')) {
        replacement.set(index, wordParagraph('Revisões e condições de aceite deste serviço avulso são as expressamente aprovadas para a atividade no Anexo I; erros técnicos continuam sujeitos a correção.'));
      }
      if (value.startsWith('O prazo geral de referência é de 45')) {
        replacement.set(index, wordParagraph('O prazo do serviço avulso é o cronograma específico aprovado no Anexo I, sem aplicação automática de prazo de projeto ou de análise de terceiros.'));
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


export { enhanceContractDocument, enhanceQuoteDocument, selectedServices };
