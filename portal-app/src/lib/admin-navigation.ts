import { Platform } from 'react-native';

// O portal publicado faz parte do site. A versão nativa conserva sua própria tela inicial.
export function usesWebsiteAdminHome() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && /^\/portal(?:\/|$)/.test(window.location.pathname);
}

export function openWebsiteAdminHome() {
  if (!usesWebsiteAdminHome()) return false;
  window.location.assign('/portal/admin/workspace/');
  return true;
}

// Áreas que continuam no Admin clássico e saem do portal React para páginas HTML legadas.
const classicWebsiteAdminRoutes: Record<string, string> = {
  'commercial-documents': '/orcamentos-contratos.html',
  'document-preparation': '/orcamentos-contratos.html',
  receipts: '/recibos.html',
  settings: '/configuracoes.html',
  'website-content': '/protecao-pdf-admin.html',
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
  'settings-center',
  'relationship-center',
  'client-center',
  'asset-center',
  'finance-center',
  'works-center',
  'document-center',
  'crm',
  'contract-documents',
  'document-governance',
  'service-level-governance',
  'document-archive',
  'tasks',
  'work-diary',
  'procurement',
  'financial',
  'portal-control',
  'construction-schedule',
  'construction-schedule-new',
  'construction-schedule-test',
  'construction-schedule-revision',
  'construction-schedule-budget',
  'construction-schedule-measurements',
  'construction-schedule-baselines',
  'approvals',
  'notifications',
  'security',
  'workspace',
]);

export function isModernWebsiteAdminSection(key: string) {
  return modernWebsiteAdminSections.has(key);
}

// O deploy publica cada área também como <rota>/index.html. A URL de diretório
// funciona no servidor estático e corresponde à rota reconhecida pelo Expo Router.
export function websiteAdminSectionUrl(key: string) {
  return `/portal/admin/${encodeURIComponent(key)}/`;
}

// Compatibilidade com chamadas antigas: a antiga "ponte" agora resolve para o arquivo
// canônico da área, sem expor a extensão física do arquivo ao Expo Router.
export function websiteAdminBridgeUrl(key: string) {
  return websiteAdminSectionUrl(key);
}

const groupedWebsiteAdminRoutes:Record<string,{area:string;view:string}>={"clients":{"area":"client-center","view":"clients"},"projects":{"area":"client-center","view":"projects"},"documents":{"area":"asset-center","view":"files"},"photos":{"area":"asset-center","view":"photos"},"document-archive":{"area":"asset-center","view":"archive"},"financial":{"area":"finance-center","view":"entries"},"receipts":{"area":"finance-center","view":"receipts"},"requests":{"area":"relationship-center","view":"requests"},"agenda":{"area":"relationship-center","view":"agenda"},"notifications":{"area":"relationship-center","view":"notifications"},"settings":{"area":"settings-center","view":"general"},"portal-control":{"area":"settings-center","view":"portal"},"security":{"area":"settings-center","view":"security"},"system-health":{"area":"settings-center","view":"health"},"service-level-governance":{"area":"settings-center","view":"services"},"website-content":{"area":"settings-center","view":"website"},"construction-schedule":{"area":"works-center","view":"complete"},"schedule":{"area":"works-center","view":"simple"},"construction-schedule-budget":{"area":"works-center","view":"budget"},"construction-schedule-measurements":{"area":"works-center","view":"measurements"},"construction-schedule-revision":{"area":"works-center","view":"revision"},"construction-schedule-baselines":{"area":"works-center","view":"baselines"},"construction-schedule-new":{"area":"works-center","view":"new"},"construction-schedule-test":{"area":"works-center","view":"test"},"tasks":{"area":"works-center","view":"tasks"},"work-diary":{"area":"works-center","view":"diary"},"procurement":{"area":"works-center","view":"procurement"},"library":{"area":"asset-center","view":"files"}};

export function openWebsiteAdminSection(key: string, params: Record<string,string> = {}) {
  const aliases:Record<string,string>={'contract-documents':'emissions','approvals':'approvals','document-governance':'tracking'};
  const aliasView=aliases[key];
  if(aliasView){params={...params,view:aliasView};key='document-center';}
  const grouped=groupedWebsiteAdminRoutes[key];
  if(grouped){params={...params,view:grouped.view};key=grouped.area;}
  const query = new URLSearchParams(params);
  const suffix = query.size ? `?${query}` : '';
  if (!usesWebsiteAdminHome()) return false;

  const classicRoute = classicWebsiteAdminRoutes[key];
  if (classicRoute) {
    window.location.assign(classicRoute + suffix);
    return true;
  }

  if (isModernWebsiteAdminSection(key)) {
    window.location.assign(websiteAdminSectionUrl(key) + suffix);
    return true;
  }

  return false;
}
