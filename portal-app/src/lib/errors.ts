const connectionPatterns = ['network request failed', 'failed to fetch', 'networkerror', 'timeout'];
const safeOperationalPatterns = [
  /^acesso administrativo necessário\.?$/i,
  /^projeto\/contrato não encontrado\.?$/i,
  /^tipo de documento não suportado\.?$/i,
  /^selecione uma aprovação para gerar o termo de aceite\.?$/i,
  /^aprovação não encontrada(?: para este projeto)?\.?$/i,
  /^este rascunho é anterior à governança documental atual\./i,
  /^complete a identificação profissional sigilosa em configurações antes de gerar este documento\./i,
  /^o documento já foi enviado\/aceito e não pode ser sobrescrito\./i,
  /^gere o contrato word oficial antes de preparar o anexo i\.?$/i,
  /^o contrato precisa estar gerado e possuir snapshot congelável antes do anexo i\.?$/i,
  /^contrato emitido não possui snapshot estruturado de serviços/i,
  /^contrato emitido não possui serviços incluídos para compor o anexo i\.?$/i,
  /^cronograma completo não contratado ou não inicializado\./i,
  /^projeto já possui cronograma aprovado vigente;/i,
  /^projeto já possui cronograma incompatível;/i,
  /^muitas (?:tentativas|operações)\./i,
];

export function toUserMessage(error: unknown, fallback = 'Não foi possível concluir esta ação. Tente novamente.') {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
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
  if (safeOperationalPatterns.some((pattern) => pattern.test(raw.trim()))) {
    return raw.trim();
  }
  return fallback;
}

export function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist/i.test(error.message ?? '');
}
