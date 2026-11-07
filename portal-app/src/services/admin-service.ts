import { readAllRows } from '@/lib/paginated-query';

import { normalizeStatus, numberOrNull } from '@/lib/format';

import { supabase } from '@/lib/supabase';
import { dispatchPendingPushNotifications } from '@/services/push-service';
import type {
  AdminNotificationSummary,
  AdminProjectSummary,
  AdminRequestSummary,
  AgendaSummary,
  ApprovalSummary,
  AuditEntrySummary,
  ScheduleStageSummary,
  ServiceResult,
  StorageOverview,
  StorageOrphanDetails,
} from '@/types/domain';

// Mantém os imports legados enquanto os módulos são refatorados.
export {
  listAdminClients,
  inviteAdminClient,
  updateAdminClientStatus,
  updateAdminClientProfile,
  resendAdminClientInvite,
  sendAdminClientRecovery,
  previewPermanentClientDeletion,
  requestPermanentClientDeletion,
  listAdminProjects,
  listAdminContracts,
  createAdminProjectDraft,
  createAdminContractProject,
  createAdminProjectForContract,
  updateAdminProject,
} from './admin-relationship-service';

// API pública mantida para todos os consumidores existentes.
export {
  listAdminContent,
  uploadAdminContent,
  createAdminContentSignedUrl,
  deleteAdminContent,
} from './admin-content-service';

// Agenda e cronograma: fachada compatível.
export {
  listAdminAgenda,
  createAdminAgenda,
  cancelAdminAgenda,
  listAdminSchedule,
  createAdminScheduleStage,
  updateAdminScheduleStage,
} from './admin-schedule-service';

// Aprovações, solicitações e notificações: fachada compatível.
export {
  listAdminApprovals,
  createAdminApproval,
  listAdminRequests,
  createAdminRequest,
  updateAdminRequest,
  listAdminNotifications,
  listAdminActivityNotifications,
  getAdminUnreadNotificationCount,
  markAdminNotificationRead,
  createAdminNotification,
} from './admin-collaboration-service';

// Métricas e auditoria do Storage: fachada compatível.
export {
  getAdminStorageOverview,
  getAdminStorageOrphanDetails,
} from './admin-storage-service';

// Histórico de auditoria: fachada compatível.
export {
  listAdminAudit,
} from './admin-audit-service';

export {
  listAdminFinancialEntries,
  listFinancialArchive,
  createAdminFinancialEntry,
  financialEntryPayload,
  updateAdminFinancialEntry,
  deleteAdminFinancialEntry,
  updateAdminContractValue,
} from './admin-financial-service';
export type { FinancialEntryInput } from './admin-financial-service';

