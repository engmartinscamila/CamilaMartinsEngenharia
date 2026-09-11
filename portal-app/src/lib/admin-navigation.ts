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

// No site publicado, as rotas do Expo são exportadas como arquivos HTML estáticos.
// Por isso os destinos modernos precisam apontar para o arquivo .html real; usar a rota
// sem extensão funciona no dev server, mas no Pages pode cair no fallback e voltar ao dashboard.
const websiteAdminRoutes: Record<string, string> = {
  crm: '/portal/admin/crm.html',
  'commercial-documents': '/orcamentos-contratos.html',
  clients: '/clientes.html',
  projects: '/projetos.html',
  documents: '/documentos.html',
  photos: '/fotos.html',
  library: '/biblioteca.html',
  financial: '/financeiro.html',
  tasks: '/portal/admin/tasks.html',
  'work-diary': '/portal/admin/work-diary.html',
  procurement: '/portal/admin/procurement.html',
  'portal-control': '/portal/admin/portal-control.html',
  'contract-documents': '/portal/admin/contract-documents.html',
  'document-preparation': '/portal/admin/document-preparation.html',
  'document-governance': '/portal/admin/document-governance.html',
  'document-archive': '/portal/admin/document-archive.html',
  agenda: '/agenda.html',
  schedule: '/cronograma.html',
  'construction-schedule': '/portal/admin/construction-schedule.html',
  approvals: '/portal/admin/approvals.html',
  requests: '/solicitacoes.html',
  notifications: '/portal/admin/notifications.html',
  security: '/portal/admin/security.html',
  'system-health': '/integridade-sistema.html',
};

export function openWebsiteAdminSection(key: string) {
  const route = websiteAdminRoutes[key];
  if (!route || !usesWebsiteAdminHome()) return false;
  window.location.assign(route);
  return true;
}
