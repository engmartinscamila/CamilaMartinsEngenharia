import { downloadBase64File } from '@/lib/download-generated-file';
import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/types/domain';

export interface CommercialServiceSelection {
  code: string;
  name: string;
  included: boolean;
  acceptanceRequired: boolean;
  displayOrder: number;
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
  totalValue: number | null;
  services: CommercialServiceSelection[];
  quoteDocumentId: string | null;
  contractDocumentId: string | null;
  linkedClientId: string | null;
  linkedContractId: string | null;
  linkedProjectId: string | null;
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

export interface NewCommercialRecordInput {
  prospectName: string;
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
  totalValue?: string;
  notes?: string;
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

export async function listCommercialRecords(): Promise<ServiceResult<CommercialRecord[]>> {
  const result = await supabase
    .from('commercial_records')
    .select('id, quote_number, contract_number, status, prospect_name, cpf_cnpj, email, phone, address, city, state, property_address, property_type, experience_level, total_value, services, quote_document_id, contract_document_id, linked_client_id, linked_contract_id, linked_project_id, created_at')
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
      totalValue: row.total_value === null ? null : Number(row.total_value),
      services: Array.isArray(row.services) ? row.services as unknown as CommercialServiceSelection[] : [],
      quoteDocumentId: row.quote_document_id,
      contractDocumentId: row.contract_document_id,
      linkedClientId: row.linked_client_id,
      linkedContractId: row.linked_contract_id,
      linkedProjectId: row.linked_project_id,
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
  const result = await supabase.rpc('admin_create_commercial_record', {
    p_data: {
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
      experience_level: input.experienceLevel ?? '',
      services: input.services,
      custom_service: input.customService ?? '',
      total_value: input.totalValue ?? '',
      notes: input.notes ?? '',
    },
  });
  return result.error || !result.data
    ? { recordId: null, error: result.error?.message ?? 'Não foi possível criar o orçamento.' }
    : { recordId: result.data as string, error: null };
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
    services: record.services.filter((item) => item.included !== false).map((item) => `(${item.code}) ${item.name}`),
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
