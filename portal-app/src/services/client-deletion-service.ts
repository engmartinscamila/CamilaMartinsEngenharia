import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/types/domain';

export interface ClientDeletionPreview {
  id: string;
  name: string;
  email: string | null;
  status: string;
  contracts: number;
  projects: number;
  documents: number;
  photos: number;
  libraryItems: number;
  financialEntries: number;
  ledgerEntries: number;
  contractedValue: number;
  alreadyArchived: number;
  storageObjects: number;
  emissionSnapshots: number;
  documentAcceptances: number;
  fiscalDocuments: number;
  retentionBlockers: number;
  canDelete: boolean;
}

export async function previewPermanentClientDeletion(clientId: string): Promise<ServiceResult<ClientDeletionPreview | null>> {
  const result = await supabase.functions.invoke('admin-delete-client', { body: { clientId, action: 'preview' } });
  if (result.error || !result.data?.preview) {
    return { data: null, error: 'A prévia segura de exclusão não está disponível. Verifique a função administrativa de exclusão.' };
  }
  const raw = result.data.preview;
  return {
    data: {
      id: raw.id,
      name: raw.name,
      email: raw.email ?? null,
      status: raw.status,
      contracts: Number(raw.contracts ?? 0),
      projects: Number(raw.projects ?? 0),
      documents: Number(raw.documents ?? 0),
      photos: Number(raw.photos ?? 0),
      libraryItems: Number(raw.libraryItems ?? 0),
      financialEntries: Number(raw.financialEntries ?? 0),
      ledgerEntries: Number(raw.ledgerEntries ?? 0),
      contractedValue: Number(raw.contractedValue ?? 0),
      alreadyArchived: Number(raw.alreadyArchived ?? 0),
      storageObjects: Number(raw.storageObjects ?? 0),
      emissionSnapshots: Number(raw.emissionSnapshots ?? 0),
      documentAcceptances: Number(raw.documentAcceptances ?? 0),
      fiscalDocuments: Number(raw.fiscalDocuments ?? 0),
      retentionBlockers: Number(raw.retentionBlockers ?? 0),
      canDelete: raw.canDelete === true,
    },
    error: null,
  };
}

export async function requestPermanentClientDeletion(clientId: string, confirmation: string): Promise<ServiceResult<{ warning: string | null } | null>> {
  const result = await supabase.functions.invoke('admin-delete-client', { body: { clientId, confirmation, action: 'delete' } });
  if (result.error || !result.data?.deleted) {
    return {
      data: null,
      error: String(result.data?.error ?? 'Não foi possível concluir a exclusão segura. Nenhuma exclusão deve ser repetida antes de conferir a auditoria.'),
    };
  }
  return {
    data: { warning: typeof result.data.warning === 'string' ? result.data.warning : null },
    error: null,
  };
}
