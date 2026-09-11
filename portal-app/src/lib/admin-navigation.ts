import { Platform } from 'react-native';

// O portal publicado faz parte do site. A versão nativa conserva sua própria tela inicial.
export function usesWebsiteAdminHome() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && /^\/portal(?:\/|$)/.test(window.location.pathname);
}

export function openWebsiteAdminHome() {
  if (!usesWebsiteAdminHome()) return false;
  window.location.assign('/admin.html');
  return true;
}

// No site publicado, algumas áreas continuam nas telas clássicas e as áreas mais novas
// vivem dentro do export do portal em /portal. Centralizar todos os destinos aqui evita
// que um router.push('/admin/...') saia do /portal e caia no fallback do dashboard.
const websiteAdminRoutes: Record<string, string> = {
  crm: '/portal/admin/crm',
  'commercial-documents': '/orcamentos-contratos.html',
  clients: '/clientes.html',
  projects: '/projetos.html',
  documents: '/documentos.html',
  photos: '/fotos.html',
  library: '/biblioteca.html',
  financial: '/financeiro.html',
  tasks: '/portal/admin/tasks',
  'work-diary': '/portal/admin/work-diary',
  procurement: '/portal/admin/procurement',
  'portal-control': '/portal/admin/portal-control',
  'contract-documents': '/portal/admin/contract-documents',
  'document-preparation': '/portal/admin/document-preparation',
  'document-governance': '/portal/admin/document-governance',
  'document-archive': '/portal/admin/document-archive',
  agenda: '/agenda.html',
  schedule: '/cronograma.html',
  approvals: '/portal/admin/approvals',
  requests: '/solicitacoes.html',
  notifications: '/portal/admin/notifications',
  security: '/portal/admin/security',
  'system-health': '/integridade-sistema.html',
};

export function openWebsiteAdminSection(key: string) {
  const route = websiteAdminRoutes[key];
  if (!route || !usesWebsiteAdminHome()) return false;
  window.location.assign(route);
  return true;
}
