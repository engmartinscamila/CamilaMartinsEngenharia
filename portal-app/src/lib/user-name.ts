import type { User } from '@supabase/supabase-js';

function cleanName(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}

export function getDisplayName(
  user: User | null,
  registeredName?: string | null,
  fallback = 'Usuário autorizado',
) {
  return cleanName(registeredName)
    ?? cleanName(user?.user_metadata?.full_name)
    ?? cleanName(user?.user_metadata?.display_name)
    ?? cleanName(user?.user_metadata?.name)
    ?? fallback;
}

export function getFirstName(displayName: string) {
  return displayName.split(/\s+/)[0] || displayName;
}
