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

const classicRoutes: Record<string, string> = {
  'commercial-documents': 'orcamentos-contratos.html', clients: 'clientes.html',
  projects: 'projetos.html', documents: 'documentos.html', photos: 'fotos.html',
  library: 'biblioteca.html', agenda: 'agenda.html', schedule: 'cronograma.html',
  requests: 'solicitacoes.html', 'system-health': 'integridade-sistema.html',
};

export function openWebsiteAdminSection(key: string) {
  const route = classicRoutes[key];
  if (!route || !usesWebsiteAdminHome()) return false;
  window.location.assign(`/${route}`);
  return true;
}
