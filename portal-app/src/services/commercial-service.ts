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

export async function listCommercialRecords(): Promise<ServiceResult<CommercialRecord[]>> {
  const result = await supabase
    .from('commercial_records')
    .select('id, quote_number, contract_number, status, prospect_name, cpf_cnpj, email, phone, property_address, property_type, experience_level, total_value, services, quote_document_id, contract_document_id, linked_client_id, linked_contract_id, linked_project_id, created_at')
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

export async function generateCommercialDocument(recordId: string, kind: 'orcamento' | 'contrato') {
  const result = await supabase.functions.invoke('generate-commercial-document', { body: { recordId, kind } });
  if (result.error || !result.data?.generated) return result.error?.message ?? `Não foi possível gerar o ${kind}.`;
  return null;
}

export async function convertCommercialRecord(recordId: string) {
  const result = await supabase.rpc('admin_convert_commercial_record', { p_record_id: recordId });
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Não foi possível converter o prospect em cliente/projeto.' };
  return { data: result.data as { client_id: string; contract_id: string; project_id: string }, error: null };
}
