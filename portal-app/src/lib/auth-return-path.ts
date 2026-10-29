import { adminSections } from './admin-sections';

const allowedPaths = new Set<string>(['/admin','/admin/contract-documents','/admin/document-governance','/admin/approvals', ...adminSections.map(section =>
  typeof section.href === 'string' ? section.href : section.href.pathname)]);

/** Guarda apenas destinos internos conhecidos; nunca concede autorização. */
export function safeAdminReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/')
    || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  const url = new URL(value, 'https://portal.invalid');
  let path = url.pathname.replace(/^\/portal(?=\/)/, '')
    .replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '');
  if (path === '/admin' && url.searchParams.has('section')) {
    const sectionPath = `/admin/${url.searchParams.get('section')}`;
    if (!allowedPaths.has(sectionPath)) return null;
    path = sectionPath;
  }
  if (!allowedPaths.has(path)) return null;
  const query = new URLSearchParams();
  const view=url.searchParams.get('view');
  if(path==='/admin/document-center'&&['emissions','approvals','tracking'].includes(view??''))query.set('view',view!);
  if(path==='/admin/document-center'){
    const filter=url.searchParams.get('filter'),q=url.searchParams.get('q');
    if(['all','waiting','overdue','accepted','rejected','superseded'].includes(filter??''))query.set('filter',filter!);
    if(q&&q.length<=200&&!/[\u0000-\u001f]/.test(q))query.set('q',q);
  }
  const projectId = url.searchParams.get('projectId');
  const tipo = url.searchParams.get('tipo');
  if (projectId && /^[a-z\d-]{1,64}$/i.test(projectId)) query.set('projectId', projectId);
  if (path === '/admin/content' && ['document', 'photo', 'library'].includes(tipo ?? '')) query.set('tipo', tipo!);
  return path + (query.size ? `?${query}` : '');
}
