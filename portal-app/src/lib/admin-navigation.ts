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

// Áreas que continuam no Admin clássico. Somente estas exigem uma navegação completa
// para fora do Expo Router. As áreas modernas DEVEM permanecer na navegação interna
// do portal para não recarregar o app e cair novamente no dashboard.
const classicWebsiteAdminRoutes: Record<string, string> = {
  'commercial-documents': '/orcamentos-contratos.html',
  clients: '/clientes.html',
  projects: '/projetos.html',
  documents: '/documentos.html',
  photos: '/fotos.html',
  library: '/biblioteca.html',
  agenda: '/agenda.html',
  schedule: '/cronograma.html',
  requests: '/solicitacoes.html',
  'system-health': '/integridade-sistema.html',
};

export const modernWebsiteAdminSections = new Set([
  'crm',
  'contract-documents',
  'document-preparation',
  'document-governance',
  'document-archive',
  'tasks',
  'work-diary',
  'procurement',
  'financial',
  'portal-control',
  'construction-schedule',
  'approvals',
  'notifications',
  'security',
]);

export function isModernWebsiteAdminSection(key: string) {
  return modernWebsiteAdminSections.has(key);
}

// Entrada estável usada pelo Admin clássico. Carregamos somente /portal/admin/index.html,
// que sempre existe no export estático, e a própria aplicação abre a área solicitada
// internamente via Expo Router. Isso elimina dependência de rewrite/fallback do servidor.
export function websiteAdminBridgeUrl(key: string) {
  return `/portal/admin/index.html?section=${encodeURIComponent(key)}`;
}

export function openWebsiteAdminSection(key: string) {
  if (!usesWebsiteAdminHome()) return false;
  const classicRoute = classicWebsiteAdminRoutes[key];
  if (!classicRoute) return false;
  window.location.assign(classicRoute);
  return true;
}
