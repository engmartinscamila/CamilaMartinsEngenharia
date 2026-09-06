import { createClient } from 'npm:@supabase/supabase-js@2';

import { environment } from '../_shared/admin.ts';
import { corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const { url, serviceKey } = environment();
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
    return json({ ok: false, error: error instanceof Error ? error.message : 'Falha na limpeza automática.' }, 500);
  }
});
