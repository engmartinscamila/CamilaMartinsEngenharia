import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal';

const APP_VERSION = Constants.expoConfig?.version?.trim() || 'unknown';

function legalError(message?: string) {
  if (message?.includes('legal_acceptances') || message?.includes('schema cache')) {
    return 'O registro de aceite não está disponível neste ambiente. Verifique a configuração dos documentos legais.';
  }
  return 'Não foi possível validar os documentos legais. Verifique a conexão e tente novamente.';
}

export async function getCurrentLegalAcceptance(userId: string) {
  const { data, error } = await supabase
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', CURRENT_TERMS_VERSION)
    .eq('privacy_version', CURRENT_PRIVACY_VERSION)
    .maybeSingle();

  return error
    ? { accepted: false, error: legalError(error.message) }
    : { accepted: Boolean(data), error: null };
}

export async function acceptCurrentLegalDocuments(platform: string) {
  const { error } = await supabase.rpc('accept_current_legal_documents', {
    p_terms_version: CURRENT_TERMS_VERSION,
    p_privacy_version: CURRENT_PRIVACY_VERSION,
    p_app_version: APP_VERSION,
    p_platform: ['android', 'ios', 'web'].includes(platform) ? platform : 'unknown',
  });

  return error ? legalError(error.message) : null;
}
