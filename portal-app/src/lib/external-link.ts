import * as Linking from 'expo-linking';

type AllowedScheme = 'https' | 'mailto';

export async function openExternalUrl(
  url: string,
  allowedSchemes: AllowedScheme[] = ['https'],
) {
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!scheme || !allowedSchemes.includes(scheme as AllowedScheme)) {
    return 'Este endereço não é permitido pelo aplicativo.';
  }

  try {
    await Linking.openURL(url);
    return null;
  } catch {
    return 'Não foi possível abrir este endereço no aparelho.';
  }
}
