import { createClient } from 'npm:@supabase/supabase-js@2';

function environment() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Configuração segura do Supabase ausente.');
  return { url, serviceKey };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function constantTimeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { url, serviceKey } = environment();
    const service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: expectedToken, error: secretError } = await service.rpc('service_internal_secret_get', {
      p_name: 'cme_cleanup_expired_assets_token',
    });
    if (secretError || typeof expectedToken !== 'string' || expectedToken.length < 32) {
      throw new Error('Autorização interna indisponível.');
    }

    const suppliedToken = request.headers.get('x-cleanup-token') ?? '';
    if (!constantTimeEqual(suppliedToken, expectedToken)) {
      return json({ error: 'Não autorizado.' }, 401);
    }

    const { data: expired, error: selectError } = await service
      .from('protected_asset_issues')
      .select('id,issued_storage_path')
      .is('cleaned_at', null)
      .lt('expires_at', new Date().toISOString())
      .order('expires_at')
      .limit(500);
    if (selectError) throw new Error('Não foi possível consultar as emissões expiradas.');

    const temporary = (expired ?? []).filter((item) => item.issued_storage_path?.startsWith('issued/'));
    if (temporary.length) {
      const removal = await service.storage.from('materiais-protegidos')
        .remove(temporary.map((item) => item.issued_storage_path));
      if (removal.error) throw new Error('Não foi possível remover as cópias temporárias expiradas.');
    }

    const ids = (expired ?? []).map((item) => item.id);
    if (ids.length) {
      const update = await service.from('protected_asset_issues')
        .update({ cleaned_at: new Date().toISOString() })
        .in('id', ids);
      if (update.error) throw new Error('Não foi possível concluir a limpeza das emissões expiradas.');
    }

    return json({ ok: true, processed: ids.length, removedTemporaryCopies: temporary.length });
  } catch (error) {
    console.error('cleanup-expired-assets:', error instanceof Error ? error.message : 'Falha interna.');
    return json({ ok: false, error: 'Falha na limpeza automática.' }, 500);
  }
});
