const clientRoutes: Record<string, string> = {
  'cliente.html': 'home', 'dashboard-cliente.html': 'home',
  'documentos-cliente.html': 'documents', 'fotos-cliente.html': 'photos',
  'biblioteca-cliente.html': 'library', 'agenda-cliente.html': 'agenda',
  'cronograma-cliente.html': 'schedule', 'solicitacoes-cliente.html': 'requests',
  'aprovacoes-cliente.html': 'approvals', 'notificacoes-cliente.html': 'notifications',
};
const adminRoutes: Record<string, string> = {
  'admin.html': '', 'clientes.html': 'clients', 'projetos.html': 'projects',
  'documentos.html': 'content', 'fotos.html': 'content', 'biblioteca.html': 'content',
  'agenda.html': 'agenda', 'cronograma.html': 'schedule', 'solicitacoes.html': 'requests',
  'financeiro.html': 'financial', 'orcamentos-contratos.html': 'commercial-documents',
  'documentos-contratuais.html': 'contract-documents', 'arquivo-documental.html': 'document-archive',
};
const clientNames = new Set(['home', 'project', 'documents', 'photos', 'library', 'agenda', 'schedule', 'requests', 'approvals', 'notifications', 'tasks', 'work-diary', 'deliveries', 'pending']);
const adminNames = new Set(['', 'settings-center', 'relationship-center', 'client-center', 'asset-center', 'finance-center', 'works-center', 'workspace', 'crm', 'commercial-documents', 'clients', 'projects', 'service-level-governance', 'document-archive', 'document-center', 'documents', 'photos', 'tasks', 'work-diary', 'procurement', 'financial', 'receipts', 'settings', 'website-content', 'portal-control', 'agenda', 'schedule', 'construction-schedule', 'construction-schedule-new', 'construction-schedule-test', 'construction-schedule-revision', 'construction-schedule-budget', 'construction-schedule-measurements', 'construction-schedule-baselines', 'requests', 'notifications', 'security', 'system-health', 'content', 'approvals', 'contract-documents', 'document-governance', 'document-preparation']);

/** Resolve only known internal destinations. Authorization remains in each route and RLS. */
export function notificationRoute(value: string | null | undefined, audience: 'client' | 'admin', notificationProjectId?: string | null) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//') || raw.includes('\\')) return null;
  let url: URL;
  try { url = new URL(raw, 'https://camilamartinsengenharia.com.br/'); } catch { return null; }
  const path = url.pathname.replace(/^\/portal(?=\/)/, '').replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '');
  const prefix = audience === 'admin' ? '/admin' : '/(client)';
  const names = audience === 'admin' ? adminNames : clientNames;
  const legacy = audience === 'admin' ? adminRoutes : clientRoutes;
  let section: string | undefined;
  if (path === prefix) section = audience === 'admin' ? '' : 'home';
  else if (path.startsWith(`${prefix}/`)) section = path.slice(prefix.length + 1);
  else section = legacy[path.replace(/^\//, '')] ?? legacy[path.replace(/^\//, '')+'.html'] ?? (audience === 'client' && clientNames.has(path.slice(1)) ? path.slice(1) : undefined);
  if (section === undefined || !names.has(section)) return null;
  const projectId = url.searchParams.get('projeto') ?? url.searchParams.get('projectId') ?? notificationProjectId;
  const params: Record<string, string> = {};
  if (projectId && /^[a-z\d-]{1,64}$/i.test(projectId)) params.projectId = projectId;
  if (audience === 'admin' && section === 'content') {
    const requestedKind = url.searchParams.get('tipo');
    params.tipo = path === '/fotos' ? 'photo' : path === '/biblioteca' ? 'library' : ['document', 'photo', 'library'].includes(requestedKind ?? '') ? requestedKind! : 'document';
  }
  if(audience==='admin'){
    for(const name of ['view','filter','financialId','receiptId','clientId']){const value=url.searchParams.get(name);if(value&&/^[a-z\d_-]{1,64}$/i.test(value))params[name]=value;}
  }
  return { pathname: `${prefix}${section ? `/${section}` : ''}`, params };
}
