import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';\nimport { Platform } from 'react-native';

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

  const complete = useCallback((token: string | null) => {
    if (!token || completed || Platform.OS !== 'web' || !safeReturnTo) return;
    setCompleted(true);
    const separator = safeReturnTo.includes('?') ? '&' : '?';
    globalThis.location?.replace?.(`${safeReturnTo}${separator}token=${encodeURIComponent(token)}`);
  }, [completed, safeReturnTo]);

  useEffect(() => {
    if (Platform.OS !== 'web') setError('Esta verificação deve ser aberta pelo navegador seguro do aplicativo.');
    else if (!safeReturnTo) setError('Destino de retorno inválido.');
    else if (!env.isTurnstileConfigured) setError('A verificação de segurança ainda não está configurada.');
  }, [safeReturnTo]);

  return (
    <AuthShell
      title="Verificação de segurança"
      description="Conclua a verificação abaixo para continuar o acesso ao aplicativo."
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!error && env.isTurnstileConfigured ? (
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
