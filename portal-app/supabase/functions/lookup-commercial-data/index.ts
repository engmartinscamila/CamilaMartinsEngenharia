import { createClient } from 'supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
});

const digitsOnly = (value: unknown) => typeof value === 'string' ? value.replace(/\D/g, '') : '';

function isValidCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const calculateDigit = (base: string, weights: number[]) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(`${first}${second}`);
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Configuração segura do Supabase ausente.');
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessão administrativa inválida.');
  const { data: isAdmin, error: adminError } = await caller.rpc('is_portal_admin');
  if (adminError || isAdmin !== true) throw new Error('Acesso administrativo necessário.');
  return caller;
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'CamilaMartinsEngenharia/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Cadastro não encontrado.' : 'Serviço de consulta temporariamente indisponível.');
    return await response.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function joinAddress(parts: unknown[]) {
  return parts
    .filter((part): part is string | number => (typeof part === 'string' && part.trim().length > 0) || typeof part === 'number')
    .map((part) => String(part).trim())
    .join(', ');
}

async function lookupCep(cep: string) {
  try {
    const data = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    return {
      cep: digitsOnly(data.cep) || cep,
      address: joinAddress([data.street, data.neighborhood]),
      neighborhood: typeof data.neighborhood === 'string' ? data.neighborhood : '',
      city: typeof data.city === 'string' ? data.city : '',
      state: typeof data.state === 'string' ? data.state : '',
      source: 'BrasilAPI',
    };
  } catch (error) {
    const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (data.erro === true) throw error instanceof Error ? error : new Error('CEP não encontrado.');
    return {
      cep: digitsOnly(data.cep) || cep,
      address: joinAddress([data.logradouro, data.bairro]),
      neighborhood: typeof data.bairro === 'string' ? data.bairro : '',
      city: typeof data.localidade === 'string' ? data.localidade : '',
      state: typeof data.uf === 'string' ? data.uf : '',
      source: 'ViaCEP',
    };
  }
}

async function lookupCnpj(cnpj: string) {
  const data = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  const phone = typeof data.ddd_telefone_1 === 'string' && data.ddd_telefone_1.trim()
    ? data.ddd_telefone_1.trim()
    : typeof data.ddd_telefone_2 === 'string' ? data.ddd_telefone_2.trim() : '';
  return {
    cnpj: digitsOnly(data.cnpj) || cnpj,
    legalName: typeof data.razao_social === 'string' ? data.razao_social.trim() : '',
    tradeName: typeof data.nome_fantasia === 'string' ? data.nome_fantasia.trim() : '',
    registrationStatus: typeof data.descricao_situacao_cadastral === 'string' ? data.descricao_situacao_cadastral.trim() : '',
    email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : '',
    phone,
    cep: digitsOnly(data.cep),
    address: joinAddress([data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.complemento, data.bairro]),
    neighborhood: typeof data.bairro === 'string' ? data.bairro.trim() : '',
    city: typeof data.municipio === 'string' ? data.municipio.trim() : '',
    state: typeof data.uf === 'string' ? data.uf.trim() : '',
    source: 'BrasilAPI',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const caller = await requireAdmin(req);
    const body = await req.json() as { kind?: string; value?: string };
    const kind = body.kind === 'cnpj' ? 'cnpj' : body.kind === 'cep' ? 'cep' : '';
    const value = digitsOnly(body.value);
    if (!kind) return json({ error: 'Tipo de consulta inválido.' }, 400);
    if (kind === 'cep' && value.length !== 8) return json({ error: 'CEP inválido. Informe 8 dígitos.' }, 400);
    if (kind === 'cnpj' && !isValidCnpj(value)) return json({ error: 'CNPJ inválido. Confira os 14 dígitos.' }, 400);

    const { error: rateError } = await caller.rpc('consume_admin_rate_limit', { p_action: `commercial-lookup-${kind}` });
    if (rateError) return json({ error: 'Muitas consultas em sequência. Aguarde alguns instantes e tente novamente.' }, 429);

    const data = kind === 'cep' ? await lookupCep(value) : await lookupCnpj(value);
    return json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir a consulta.';
    const status = message.includes('Acesso') ? 403 : message.includes('Sessão') ? 401 : message.includes('não encontrado') ? 404 : 502;
    return json({ error: message }, status);
  }
});
