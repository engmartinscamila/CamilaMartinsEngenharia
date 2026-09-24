import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

const CAPTCHA_RETURN_URL = 'camilamartinsengenharia://captcha-complete';
const CAPTCHA_WEB_URL = 'https://camilamartinsengenharia.com.br/portal/captcha.html';

export async function requestNativeCaptchaToken(): Promise<{ token: string | null; error: string | null }> {
  const challengeUrl = `${CAPTCHA_WEB_URL}?returnTo=${encodeURIComponent(CAPTCHA_RETURN_URL)}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(challengeUrl, CAPTCHA_RETURN_URL);
    if (result.type !== 'success' || !result.url) {
      return { token: null, error: 'A verificação de segurança não foi concluída.' };
    }

    const parsed = Linking.parse(result.url);
    const token = typeof parsed.queryParams?.token === 'string' ? parsed.queryParams.token.trim() : '';
    if (!token) {
      return { token: null, error: 'A verificação de segurança não retornou uma confirmação válida.' };
    }

    return { token, error: null };
  } catch {
    return { token: null, error: 'Não foi possível abrir a verificação de segurança.' };
  }
}

export function isAllowedCaptchaReturnUrl(value: string | undefined) {
  return value === CAPTCHA_RETURN_URL;
}

export const captchaWebUrl = CAPTCHA_WEB_URL;
export const captchaReturnUrl = CAPTCHA_RETURN_URL;
