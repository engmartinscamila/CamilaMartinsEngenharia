export type AppRole = 'admin' | 'client' | 'collaborator' | 'unassigned';

export type ContractStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'archived';
export type ProjectStatus = 'ativo' | 'pausado' | 'concluido' | 'arquivado' | string;

export interface ClientProfile {
  id: string;
  authId: string | null;
  name: string;
  email: string | null;
  status: string;
}

export interface ContractSummary {
  id: string;
  contractNumber: string;
  clientId: string;
  serviceType: string | null;
  status: ContractStatus | string;
  contractValue: number | null;
  currency: string;
}

export interface ProjectSummary {
  id: string;
  clientId: string;
  contractId: string | null;
  contractNumber: string;
  name: string;
  serviceType: string | null;
  status: ProjectStatus;
  progress: number | null;
  city: string | null;
  state: string | null;
}

export interface ProjectContext extends ProjectSummary {
  contract: ContractSummary | null;
}

export interface DocumentSummary {
  id: string;
  projectId: string | null;
  title: string;
  category: string;
  version: string | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string;
  allowDownload: boolean;
  protectionMode: 'administrative' | 'authored_pdf';
}

export interface PhotoSummary {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
  protectionMode: 'administrative' | 'authored_photo';
}

export interface LibraryItemSummary {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  storageBucket: string;
  storagePath: string | null;
}

export interface AgendaSummary {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  eventType: string | null;
  invitationStatus: string;
  meetingUrl: string | null;
  cancelled: boolean;
}

export interface ScheduleStageSummary {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  progress: number | null;
  weight: number | null;
  order: number;
}

export interface ApprovalSummary {
  id: string;
  projectId: string | null;
  type: string;
  title: string;
  description: string | null;
  status: string;
  comment: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface RequestSummary {
  id: string;
  projectId: string | null;
  category: string;
  title: string;
  message: string | null;
  status: string;
  origin: 'cliente' | 'administrador' | 'admin' | string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestReplySummary {
  id: string;
  requestId: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  message: string | null;
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
  category: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  accountId: string | null;
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

export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ProjectTaskSummary {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  weight: number;
  clientVisible: boolean;
  position: number;
  dependencyIds: string[];
}

export interface TaskTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface WorkDiarySummary {
  id: string;
  projectId: string;
  entryDate: string;
  weather: string | null;
  teamCount: number | null;
  activities: string;
  occurrences: string | null;
  materials: string | null;
  nextSteps: string | null;
  voiceTranscript: string | null;
  clientVisible: boolean;
  createdAt: string;
}

export interface SupplierSummary {
  id: string;
  name: string;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  active: boolean;
}

export interface SupplierBidSummary {
  id: string;
  quoteId: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
}

export interface PurchaseQuoteSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  selectedSupplierId: string | null;
  clientVisible: boolean;
  itemCount: number;
  bids: SupplierBidSummary[];
}

export interface ProjectFinancialSummary {
  projectId: string;
  projectName: string;
  contractNumber: string;
  contractValue: number | null;
  received: number;
  receivable: number;
  paidCosts: number;
  payable: number;
  hours: number;
  laborCost: number;
}

export interface FinancialAccountSummary {
  id: string;
  name: string;
  accountType: 'bank' | 'cash' | 'credit';
  openingBalance: number;
  active: boolean;
}

export interface TimesheetSummary {
  id: string;
  projectId: string;
  workDate: string;
  hours: number;
  hourlyCost: number;
  description: string;
  billable: boolean;
}

export interface FiscalDocumentSummary {
  id: string;
  projectId: string;
  status: string;
  provider: string | null;
  externalId: string | null;
  description: string;
  amount: number;
  issuedAt: string | null;
  errorMessage: string | null;
}

export interface ProjectPortalSettings {
  projectId: string;
  showDocuments: boolean;
  showPhotos: boolean;
  showLibrary: boolean;
  showAgenda: boolean;
  showSchedule: boolean;
  showApprovals: boolean;
  showRequests: boolean;
  showTasks: boolean;
  showWorkDiary: boolean;
}

export interface AutomationRunSummary {
  id: string;
  jobName: string;
  status: 'running' | 'success' | 'error';
  metrics: Record<string, number>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}
