import { downloadBase64File } from '@/lib/download-generated-file';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import type { ServiceResult } from '@/types/domain';

export type CommercialServiceLevelCode = 'bronze' | 'prata' | 'ouro';

export interface CommercialCoobligor {
  kind: 'spouse_companion' | 'company_guarantor' | 'other_guarantor';
  name: string;
  cpf: string;
  role?: string | null;
}

export interface CommercialServiceSelection {
  code: string;
  name: string;
  included: boolean;
  acceptanceRequired: boolean;
  displayOrder: number;
  levelApplicable?: boolean;
  levelCode?: CommercialServiceLevelCode | null;
  level?: { code?: string; label?: string; subtitle?: string } | null;
}

export interface CommercialCatalogService {
  code: string;
  name: string;
  category: string;
  levelApplicable: boolean;
  acceptanceRequired: boolean;
  description: string;
  deliverables: string[];
  exclusions: string[];
  aliases: string[];
  synonyms: string[];
  keywords: string[];
}

export interface CommercialRecord {
  id: string;
  quoteNumber: string;
  contractNumber: string | null;
  status: string;
  prospectName: string;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  propertyAddress: string | null;
  propertyType: string | null;
  experienceLevel: string | null;
  customService: string | null;
  totalValue: number | null;
  services: CommercialServiceSelection[];
  coobligors: CommercialCoobligor[];
  quoteDocumentId: string | null;
  contractDocumentId: string | null;
  linkedClientId: string | null;
  linkedContractId: string | null;
  linkedProjectId: string | null;
  crmStage: string;
  crmPriority: string;
  crmSource: string | null;
  nextActionAt: string | null;
  lostReason: string | null;
  createdAt: string;
}

export interface CommercialDocumentPreview {
  kind: 'orcamento' | 'contrato';
  number: string;
  prospectName: string;
  partyAddress: string | null;
  propertyAddress: string | null;
  totalValue: number | null;
  services: string[];
  currentVersion: string | null;
  nextVersion: string;
  frozen: boolean;
}

export interface ExistingCommercialClient {
  id: string;
  name: string;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
}

export interface NewCommercialRecordInput {
  prospectName: string;
  linkedClientId?: string | null;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  cep?: string;
  address?: string;
  city?: string;
  state?: string;
  propertyAddress?: string;
  propertyType?: string;
  areaTerrenoM2?: string;
  areaConstruidaM2?: string;
  constructionStandard?: string;
  experienceLevel?: string;
  services: CommercialServiceSelection[];
  customService?: string;
  customServiceLevel?: CommercialServiceLevelCode | null;
  totalValue?: string;
  notes?: string;
  coobligors?: CommercialCoobligor[];
}

export interface CommercialAddressLookup {
  cep: string;
  address: string;
  city: string;
  state: string;
  neighborhood?: string;
}

export interface CommercialCnpjLookup extends CommercialAddressLookup {
  cnpj: string;
  legalName: string;
  tradeName?: string;
  phone?: string;
  email?: string;
  registrationStatus?: string;
}

const isOtherCode = (code: string) => ['p', 'outro', 'outros'].includes(code.trim().toLowerCase());
const genericDescription = /^(outro|outros|a definir|servi[cç]o t[eé]cnico)$/i;

/** Retorna uma descrição identificável antes de gravar o escopo que será congelado nos documentos. */
export function validateCustomCommercialService(input: Pick<NewCommercialRecordInput, 'services' | 'customService'>): string | null {
  const selected = input.services.filter(item => item.included);
  const otherSelected = selected.some(item => isOtherCode(item.code));
  const description = (input.customService ?? '').trim();
  if (otherSelected && (description.length < 12 || genericDescription.test(description))) {
    return 'Descreva a atividade selecionada em Outros com pelo menos 12 caracteres. Informe o serviço concreto; não use apenas "outros" ou "a definir".';
  }
  if (description && (description.length < 12 || genericDescription.test(description))) {
    return 'A descrição do serviço personalizado deve identificar a atividade com pelo menos 12 caracteres.';
  }
  if (!selected.length && !description) return 'Selecione ao menos uma atividade ou descreva um serviço personalizado.';
  return null;
}

export async function listCommercialServiceCatalog(): Promise<ServiceResult<CommercialCatalogService[]>> {
  const result = await supabase
    .from('service_catalog')
    .select('code, name, category, level_applicable, acceptance_required, description, deliverables, exclusions, aliases, synonyms, keywords')
    .eq('active', true)
    .order('code');

  if (result.error) {
    return { data: [], error: result.error.message ?? 'Não foi possível carregar o catálogo central de serviços.' };
  }

  return {
    data: (result.data ?? []).map((row: any) => ({
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      category: String(row.category ?? ''),
      levelApplicable: row.level_applicable === true,
      acceptanceRequired: row.acceptance_required !== false,
      description: String(row.description ?? ''),
      deliverables: Array.isArray(row.deliverables) ? row.deliverables.map(String) : [],
      exclusions: Array.isArray(row.exclusions) ? row.exclusions.map(String) : [],
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
      synonyms: Array.isArray(row.synonyms) ? row.synonyms.map(String) : [],
      keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    })).filter((row) => row.code && row.name),
    error: null,
  };
}

export async function searchExistingCommercialClients(query: string): Promise<ServiceResult<ExistingCommercialClient[]>> {
  const value = query.trim();
  const digits = value.replace(/\D/g, '');
  if (value.length < 2 && digits.length < 3) return { data: [], error: null };
  const result = await supabase.rpc('admin_search_existing_clients', { p_query: value, p_limit: 12 });
  if (result.error) return { data: [], error: result.error.message ?? 'Não foi possível pesquisar clientes existentes.' };
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    data: rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.nome ?? ''),
      cpfCnpj: row.cpf_cnpj ?? null,
      email: row.email ?? null,
      phone: row.telefone ?? null,
      address: row.endereco ?? null,
      city: row.cidade ?? null,
      state: row.estado ?? null,
      cep: row.cep ?? null,
    })),
    error: null,
  };
}

export async function listCommercialRecords(): Promise<ServiceResult<CommercialRecord[]>> {
  const result = await supabase
    .from('commercial_records')
    .select('id, quote_number, contract_number, status, prospect_name, cpf_cnpj, email, phone, address, city, state, property_address, property_type, experience_level, custom_service, total_value, services, coobligors, quote_document_id, contract_document_id, linked_client_id, linked_contract_id, linked_project_id, crm_stage, crm_priority, crm_source, next_action_at, lost_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (result.error) return { data: [], error: 'Não foi possível carregar os orçamentos e contratos.' };
  return {
    data: (result.data ?? []).map((row) => ({
      id: row.id,
      quoteNumber: row.quote_number,
      contractNumber: row.contract_number,
      status: row.status,
      prospectName: row.prospect_name,
      cpfCnpj: row.cpf_cnpj,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      propertyAddress: row.property_address,
      propertyType: row.property_type,
      experienceLevel: row.experience_level,
      customService: row.custom_service,
      totalValue: row.total_value === null ? null : Number(row.total_value),
      services: Array.isArray(row.services) ? row.services as unknown as CommercialServiceSelection[] : [],
      coobligors: Array.isArray(row.coobligors) ? row.coobligors as CommercialCoobligor[] : [],
      quoteDocumentId: row.quote_document_id,
      contractDocumentId: row.contract_document_id,
      linkedClientId: row.linked_client_id,
      linkedContractId: row.linked_contract_id,
      linkedProjectId: row.linked_project_id,
      crmStage: row.crm_stage ?? 'novo',
      crmPriority: row.crm_priority ?? 'normal',
      crmSource: row.crm_source,
      nextActionAt: row.next_action_at,
      lostReason: row.lost_reason,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function lookupCommercialCep(cep: string): Promise<ServiceResult<CommercialAddressLookup | null>> {
  const result = await supabase.functions.invoke('lookup-commercial-data', { body: { kind: 'cep', value: cep } });
  if (result.error || !result.data?.data) return { data: null, error: result.data?.error ?? result.error?.message ?? 'Não foi possível consultar o CEP.' };
  return { data: result.data.data as CommercialAddressLookup, error: null };
}

export async function lookupCommercialCnpj(cnpj: string): Promise<ServiceResult<CommercialCnpjLookup | null>> {
  const result = await supabase.functions.invoke('lookup-commercial-data', { body: { kind: 'cnpj', value: cnpj } });
  if (result.error || !result.data?.data) return { data: null, error: result.data?.error ?? result.error?.message ?? 'Não foi possível consultar o CNPJ.' };
  return { data: result.data.data as CommercialCnpjLookup, error: null };
}

export async function createCommercialRecord(input: NewCommercialRecordInput) {
  const invalid = validateCustomCommercialService(input);
  if (invalid) return { recordId: null, error: invalid };
  const description = (input.customService ?? '').trim();
  // Ao descrever uma atividade personalizada, sua categoria deve integrar o snapshot.
  // Um serviço já selecionado não é removido nem convertido em "Outros".
  const services = input.services.map(item => isOtherCode(item.code) && description
    ? { ...item, included: true, levelCode: item.levelCode ?? input.customServiceLevel ?? null, customDescription: description }
    : item);
  if (description && !services.some(item => isOtherCode(item.code))) {
    services.push({
      code: 'p',
      name: 'Outro',
      included: true,
      acceptanceRequired: true,
      displayOrder: services.length + 1,
      levelApplicable: true,
      levelCode: input.customServiceLevel ?? null,
      customDescription: description,
    });
  }

  const legacyLevel = (input.experienceLevel ?? '').trim().toLowerCase();
  const missingLevel = services.find(item =>
    item.included !== false &&
    item.levelApplicable !== false &&
    !item.levelCode &&
    !legacyLevel
  );
  if (missingLevel) {
    return { recordId: null, error: `Selecione Bronze, Prata ou Ouro para o serviço ${missingLevel.name}.` };
  }
  if (description) {
    const custom = services.find(item => isOtherCode(item.code) && item.included !== false);
    if (custom?.levelApplicable !== false && !custom?.levelCode && !legacyLevel) {
      return { recordId: null, error: 'Selecione Bronze, Prata ou Ouro para a atividade personalizada.' };
    }
  }

  const explicitLevels = [...new Set(services
    .filter(item => item.included !== false && item.levelCode)
    .map(item => item.levelCode as CommercialServiceLevelCode))];
  const compatibilityLevel = explicitLevels.length === 1 ? explicitLevels[0] : explicitLevels.length === 0 ? legacyLevel : '';

  const p_data = {
    prospect_name: input.prospectName,
    cpf_cnpj: input.cpfCnpj ?? '',
    email: input.email ?? '',
    phone: input.phone ?? '',
    cep: input.cep ?? '',
    address: input.address ?? '',
    city: input.city ?? '',
    state: input.state ?? '',
    property_address: input.propertyAddress ?? '',
    property_type: input.propertyType ?? '',
    area_terreno_m2: input.areaTerrenoM2 ?? '',
    area_construida_m2: input.areaConstruidaM2 ?? '',
    construction_standard: input.constructionStandard ?? '',
    experience_level: compatibilityLevel,
    services,
    custom_service: description,
    total_value: input.totalValue ?? '',
    notes: input.notes ?? '',
  };
  const result = input.linkedClientId
    ? await supabase.rpc('admin_create_commercial_record_from_client', { p_client_id: input.linkedClientId, p_data })
    : await supabase.rpc('admin_create_commercial_record', { p_data });
  if (result.error || !result.data) {
    return { recordId: null, error: result.error?.message ?? 'Não foi possível criar o orçamento.' };
  }
  const recordId = result.data as string;
  if ((input.coobligors ?? []).length) {
    const coobligorResult = await supabase.rpc('admin_set_commercial_coobligors', {
      p_record_id: recordId,
      p_coobligors: input.coobligors,
    });
    if (coobligorResult.error) {
      return { recordId, error: `Orçamento criado, mas os coobrigados não foram gravados: ${coobligorResult.error.message}` };
    }
  }
  return { recordId, error: null };
}

function bumpVersion(current: string | null, bump: 'minor' | 'major') {
  if (!current) return '1.0';
  const match = current.match(/(\d+)\.(\d+)/);
  const major = Number(match?.[1] ?? 1);
  const minor = Number(match?.[2] ?? 0);
  return bump === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export async function previewCommercialDocument(record: CommercialRecord, kind: 'orcamento' | 'contrato', bump: 'minor' | 'major' = 'minor'): Promise<ServiceResult<CommercialDocumentPreview | null>> {
  const documentId = kind === 'orcamento' ? record.quoteDocumentId : record.contractDocumentId;
  let currentVersion: string | null = null;
  let frozen = false;
  if (documentId) {
    const [doc, snapshot] = await Promise.all([
      supabase.from('documentos').select('versao').eq('id', documentId).maybeSingle(),
      supabase.from('document_emission_snapshots').select('id').eq('document_id', documentId).maybeSingle(),
    ]);
    if (doc.error || snapshot.error) return { data: null, error: 'Não foi possível conferir a versão atual do documento.' };
    currentVersion = doc.data?.versao ? String(doc.data.versao) : '1.0';
    frozen = Boolean(snapshot.data);
  }
  return { data: {
    kind,
    number: kind === 'contrato' ? record.contractNumber ?? 'Será gerado automaticamente' : record.quoteNumber,
    prospectName: record.prospectName,
    partyAddress: record.address,
    propertyAddress: record.propertyAddress,
    totalValue: record.totalValue,
    services: record.services.filter(item => item.included !== false).map(item => isOtherCode(item.code) && record.customService
      ? `(p) Serviço personalizado: ${record.customService}`
      : `(${item.code}) ${item.name}${item.levelCode ? ` — ${String(item.levelCode).toUpperCase()}` : ''}`),
    currentVersion,
    nextVersion: frozen ? bumpVersion(currentVersion, bump) : currentVersion ?? '1.0',
    frozen,
  }, error: null };
}

export async function generateCommercialDocument(recordId: string, kind: 'orcamento' | 'contrato', archive = false, version?: { bump: 'minor' | 'major'; reason: string }) {
  const generated = await supabase.functions.invoke('generate-commercial-document-final', { body: { recordId, kind, versionBump: version?.bump ?? 'minor', versionReason: version?.reason ?? '' } });
  if (generated.error || !generated.data?.generated || !generated.data?.documentId) return generated.data?.error ?? generated.error?.message ?? `Não foi possível gerar o ${kind}.`;

  const delivered = await supabase.functions.invoke('deliver-generated-document', { body: { documentId: generated.data.documentId, archive, expectedDocumentKind: kind } });
  if (delivered.error || !delivered.data?.delivered || !delivered.data?.contentBase64 || delivered.data?.documentKind !== kind) return delivered.data?.error ?? delivered.error?.message ?? 'O Word retornado não corresponde ao tipo solicitado.';

  try {
    await downloadBase64File(String(delivered.data.contentBase64), String(delivered.data.fileName ?? `${kind}.docx`));
  } catch (error) {
    return error instanceof Error ? error.message : 'O Word foi gerado, mas não foi possível abrir o download.';
  }
  return null;
}

export async function convertCommercialRecord(recordId: string) {
  const result = await supabase.rpc('admin_convert_commercial_record', { p_record_id: recordId });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível converter o prospect em cliente/projeto.' };
  return { data: result.data as { client_id: string; contract_id: string; project_id: string }, error: null };
}

export async function createProspectAccessLink(recordId: string, expiresHours = 72) {
  const result = await supabase.rpc('admin_create_prospect_access_link', {
    p_commercial_record_id: recordId,
    p_expires_hours: expiresHours,
  });
  if (result.error || !result.data) return { url: null, error: result.error?.message ?? 'Não foi possível criar o acesso temporário.' };
  return {
    url: Linking.createURL('/prospect-access', { queryParams: { token: String(result.data) } }),
    error: null,
  };
}

export async function setCommercialCoobligors(recordId: string, coobligors: CommercialCoobligor[]) {
  const result = await supabase.rpc('admin_set_commercial_coobligors', {
    p_record_id: recordId,
    p_coobligors: coobligors,
  });
  return result.error ? result.error.message ?? 'Não foi possível atualizar os coobrigados.' : null;
}
