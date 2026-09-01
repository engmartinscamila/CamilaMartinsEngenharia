export interface ContractSummary {
  id: string;
  contractNumber: string;
  clientId: string;
  serviceType: string | null;
  status: string;
  contractValue: number | null;
  currency: string;
}

export interface ProjectContext {
  id: string;
  clientId: string;
  contractId: string | null;
  contractNumber: string;
  name: string;
  serviceType: string | null;
  status: string;
  progress: number | null;
  city: string | null;
  state: string | null;
  contract: ContractSummary | null;
}

export interface ClientProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  authId: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  category: string | null;
  version: string | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
  allowDownload: boolean;
  protectionMode: 'administrative' | 'authored_pdf';
}

export interface PhotoSummary {
  id: string;
  title: string;
  category: string | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
  protectionMode: 'administrative' | 'authored_photo';
}

export interface LibrarySummary {
  id: string;
  title: string;
  category: string | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
}

export interface ScheduleStageSummary {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  progress: number | null;
  order: number | null;
}

export interface AgendaSummary {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: string | null;
  meetingUrl: string | null;
  inviteStatus: string | null;
  cancelled: boolean;
}

export interface ApprovalSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface RequestSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  createdByAdmin: boolean | null;
  adminResponse: string | null;
}

export interface NotificationSummary {
  id: string;
  title: string;
  message: string;
  type: string | null;
  read: boolean;
  createdAt: string;
  linkPath: string | null;
}

export interface DashboardCounts {
  activeClients: number | null;
  activeProjects: number | null;
  openRequests: number | null;
  pendingApprovals: number | null;
}

export interface NotificationCounts {
  unread: number | null;
}

export interface ProjectHighlights {
  nextStage: ScheduleStageSummary | null;
  nextEvent: AgendaSummary | null;
  pendingApprovals: number | null;
  recentDocuments: number | null;
  openRequests: number | null;
}

export interface AdminClientSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  authId: string | null;
  createdAt: string;
  partnership?: boolean;
}

export interface AdminProjectSummary extends ProjectContext {
  clientName: string;
}

export interface AdminContractSummary extends ContractSummary {
  clientName: string;
}

export type AdminContentKind = 'document' | 'photo' | 'library';

export interface AdminContentSummary {
  id: string;
  kind: AdminContentKind;
  title: string;
  category: string;
  version: string | null;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
  allowDownload: boolean;
  protectionMode: 'administrative' | 'authored_pdf' | 'authored_photo';
}

export interface AdminRequestSummary extends RequestSummary {
  clientName: string;
  projectName: string;
}

export interface AdminNotificationSummary extends NotificationSummary {
  clientName: string;
  projectName: string;
}

export interface StorageBucketSummary {
  bucketId: string;
  objectCount: number;
  bytes: number;
}

export interface StorageProjectSummary {
  projectId: string;
  projectName: string;
  clientName: string;
  contractNumber: string;
  objectCount: number;
  bytes: number;
}

export interface StorageOverview {
  buckets: StorageBucketSummary[];
  projects: StorageProjectSummary[];
  totalObjects: number;
  totalBytes: number;
  orphanMetadata: number;
  orphanObjects: number;
}

export interface StorageOrphanMetadata {
  kind: string;
  id: string;
  name: string;
  bucket: string;
  path: string;
  projectId: string | null;
}

export interface StorageOrphanObject {
  bucket: string;
  path: string;
  size: number;
  createdAt: string | null;
}

export interface StorageOrphanDetails {
  orphanMetadata: StorageOrphanMetadata[];
  orphanObjects: StorageOrphanObject[];
}

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
}

export interface FinancialEntrySummary {
  id: string;
  projectId: string | null;
  projectName: string;
  clientName: string;
  contractNumber: string;
  type: string;
  description: string;
  amount: number;
  date: string | null;
  notes: string | null;
  category?: string;
  status?: string;
  dueDate?: string | null;
  paymentDate?: string | null;
  paymentMethod?: string | null;
}

export interface FinancialArchiveSummary {
  id: string;
  sourceTable: string;
  clientName: string;
  contractNumber: string;
  serviceType: string | null;
  contractValue: number | null;
  type: string | null;
  description: string | null;
  amount: number | null;
  date: string | null;
  archivedAt: string;
  reason: string;
}

export interface AuditEntrySummary {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}
