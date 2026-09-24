const siteKey = (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
const publishableKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

if (siteKey.length < 10) {
  throw new Error('TURNSTILE_SITE_KEY não está disponível para a validação de produção.');
}
if (!supabaseUrl || !publishableKey) {
  throw new Error('Supabase URL/chave pública ausentes na validação do CAPTCHA.');
}

const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: publishableKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'captcha-production-check@example.invalid',
    password: 'synthetic-not-a-real-account',
  }),
});

const body = await response.text();
const normalized = body.toLowerCase();

if (response.ok) {
  throw new Error('A tentativa sintética sem CAPTCHA foi aceita, o que não deveria acontecer.');
}

if (!normalized.includes('captcha')) {
  throw new Error(
    `O Supabase não rejeitou a tentativa pela ausência de CAPTCHA. Status ${response.status}; resposta: ${body.slice(0, 240)}`,
  );
}

console.log('PASS: site key disponível e Supabase Auth rejeita login sem CAPTCHA.');
