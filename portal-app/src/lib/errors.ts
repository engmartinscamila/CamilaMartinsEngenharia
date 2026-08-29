const connectionPatterns = ['network request failed', 'failed to fetch', 'networkerror', 'timeout'];

export function toUserMessage(error: unknown, fallback = 'Não foi possível concluir esta ação. Tente novamente.') {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = raw.toLowerCase();

  if (connectionPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'Sem conexão com o serviço. Verifique sua internet e tente novamente.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Seu acesso ainda não foi confirmado. Use o link enviado por e-mail.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  if (normalized.includes('expired') || normalized.includes('otp')) {
    return 'Este link expirou ou já foi utilizado. Solicite um novo link.';
  }
  return fallback;
}

export function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist/i.test(error.message ?? '');
}
