import React, { useEffect, useId } from 'react';
import { Platform, View } from 'react-native';

type TurnstileApi = {
  render: (container: string, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

type BrowserScript = {
  id: string;
  src: string;
  async: boolean;
  defer: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

type BrowserDocument = {
  getElementById: (id: string) => BrowserScript | null;
  createElement: (tag: 'script') => BrowserScript;
  head: { appendChild: (node: BrowserScript) => void };
};

type BrowserGlobal = typeof globalThis & {
  document?: BrowserDocument;
  turnstile?: TurnstileApi;
};

const SCRIPT_ID = 'cme-cloudflare-turnstile';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstilePromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  const browser = globalThis as BrowserGlobal;
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
    const doc = browser.document;
    if (!doc) {
      reject(new Error('Turnstile indisponível fora do navegador.'));
      return;
    }

    const finish = () => {
      if (browser.turnstile) resolve(browser.turnstile);
      else reject(new Error('Não foi possível iniciar a verificação de segurança.'));
    };

    if (doc.getElementById(SCRIPT_ID)) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        if (browser.turnstile) {
          clearInterval(interval);
          resolve(browser.turnstile);
        } else if (attempts >= 100) {
          clearInterval(interval);
          reject(new Error('Tempo esgotado ao carregar a verificação de segurança.'));
        }
      }, 100);
      return;
    }

    const script = doc.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('Falha ao carregar a verificação de segurança.'));
    doc.head.appendChild(script);
  }).catch((error) => {
    turnstilePromise = null;
    throw error;
  });

  return turnstilePromise;
}

export function TurnstileCaptcha({
  siteKey,
  onTokenChange,
  onError,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const rawId = useId();
  const containerId = `cme-turnstile-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    if (Platform.OS !== 'web' || !siteKey) return;

    let active = true;
    let widgetId: string | null = null;
    onTokenChange(null);
    onError(null);

    void loadTurnstile()
      .then((turnstile) => {
        if (!active) return;
        widgetId = turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          theme: 'auto',
          language: 'pt-BR',
          callback: (token: unknown) => {
            if (active) onTokenChange(typeof token === 'string' ? token : null);
          },
          'expired-callback': () => {
            if (active) onTokenChange(null);
          },
          'timeout-callback': () => {
            if (active) onTokenChange(null);
          },
          'error-callback': () => {
            if (!active) return;
            onTokenChange(null);
            onError('Não foi possível concluir a verificação de segurança. Tente novamente.');
          },
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChange(null);
        onError('Não foi possível carregar a verificação de segurança. Atualize a página e tente novamente.');
      });

    return () => {
      active = false;
      const browser = globalThis as BrowserGlobal;
      if (widgetId && browser.turnstile) browser.turnstile.remove(widgetId);
    };
  }, [containerId, onError, onTokenChange, siteKey]);

  if (Platform.OS !== 'web' || !siteKey) return null;
  return <View nativeID={containerId} style={{ minHeight: 70, alignItems: 'center', justifyContent: 'center' }} />;
}
