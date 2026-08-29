const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const legacyAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const supabaseAnonKey = supabasePublishableKey || legacyAnonKey;
const expectedProjectRef = process.env.EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF?.trim().toLowerCase() ?? '';
const requestedEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase() ?? 'development';
const appEnvironment = ['development', 'homologation', 'production'].includes(requestedEnvironment)
  ? (requestedEnvironment as 'development' | 'homologation' | 'production')
  : 'development';

const projectRef = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1]?.toLowerCase() ?? '';
const urlIsValid = Boolean(projectRef);
const keyLooksPublic = supabaseAnonKey.length > 20
  && !supabaseAnonKey.startsWith('sb_secret_')
  && !supabaseAnonKey.toLowerCase().includes('service_role');
const projectMatches = !expectedProjectRef || projectRef === expectedProjectRef;
const isSupabaseConfigured = urlIsValid && keyLooksPublic && projectMatches;

function configurationIssue() {
  if (!supabaseUrl || !supabaseAnonKey) return 'Informe a URL do serviço e a chave pública do ambiente.';
  if (!urlIsValid) return 'A URL informada não corresponde a um serviço válido.';
  if (!keyLooksPublic) return 'Use somente a chave pública do ambiente. Chaves administrativas são bloqueadas no aplicativo.';
  if (!projectMatches) return 'Conexão bloqueada: a URL não pertence ao ambiente esperado.';
  return null;
}

export const env = {
  appEnvironment,
  supabaseUrl,
  supabaseAnonKey,
  projectRef,
  expectedProjectRef,
  isHomologation: appEnvironment === 'homologation',
  isSupabaseConfigured,
  configurationIssue: configurationIssue(),
} as const;
