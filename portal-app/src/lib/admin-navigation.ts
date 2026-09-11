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

// Áreas que continuam no Admin clássico e saem do portal React para páginas HTML legadas.
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

// No site publicado cada área moderna possui um HTML estático real em /portal/admin/.
// Usamos esse arquivo diretamente em vez de depender de rewrite/fallback do servidor.
export function websiteAdminSectionUrl(key: string) {
  return `/portal/admin/${encodeURIComponent(key)}.html`;
}

// Compatibilidade com chamadas antigas: a antiga "ponte" agora resolve para o arquivo
// estático real da área, evitando URLs ?section= que podiam cair em Página não encontrada.
export function websiteAdminBridgeUrl(key: string) {
  return websiteAdminSectionUrl(key);
}

export function openWebsiteAdminSection(key: string) {
  if (!usesWebsiteAdminHome()) return false;

  const classicRoute = classicWebsiteAdminRoutes[key];
  if (classicRoute) {
    window.location.assign(classicRoute);
    return true;
  }

  if (isModernWebsiteAdminSection(key)) {
    window.location.assign(websiteAdminSectionUrl(key));
    return true;
  }

  return false;
}
