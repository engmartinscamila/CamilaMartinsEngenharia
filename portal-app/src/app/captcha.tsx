import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { TurnstileCaptcha } from '@/components/turnstile-captcha';
import { Notice } from '@/components/ui';
import { isAllowedCaptchaReturnUrl } from '@/lib/captcha';
import { env } from '@/lib/env';

export default function CaptchaScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const safeReturnTo = typeof returnTo === 'string' && isAllowedCaptchaReturnUrl(returnTo) ? returnTo : null;
  const configurationError = Platform.OS !== 'web'
    ? 'Esta verificação deve ser aberta pelo navegador seguro do aplicativo.'
    : !safeReturnTo
      ? 'Destino de retorno inválido.'
      : !env.isTurnstileConfigured
        ? 'A verificação de segurança ainda não está configurada.'
        : null;
  const visibleError = error ?? configurationError;

  const complete = useCallback((token: string | null) => {
    if (!token || completed || Platform.OS !== 'web' || !safeReturnTo) return;
    setCompleted(true);
    const separator = safeReturnTo.includes('?') ? '&' : '?';
    globalThis.location?.replace?.(`${safeReturnTo}${separator}token=${encodeURIComponent(token)}`);
  }, [completed, safeReturnTo]);

  return (
    <AuthShell
      title="Verificação de segurança"
      description="Conclua a verificação abaixo para continuar o acesso ao aplicativo."
    >
      {visibleError ? <Notice tone="danger">{visibleError}</Notice> : null}
      {!visibleError && env.isTurnstileConfigured ? (
        <TurnstileCaptcha
          onError={setError}
          onTokenChange={complete}
          siteKey={env.turnstileSiteKey}
        />
      ) : null}
      {completed ? <Notice tone="info">Verificação concluída. Retornando ao aplicativo.</Notice> : null}
    </AuthShell>
  );
}
