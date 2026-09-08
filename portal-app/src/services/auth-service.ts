import type { User } from '@supabase/supabase-js';

import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { AppRole, ClientProfile } from '@/types/domain';

export async function resolveIdentity(user: User): Promise<{
  role: AppRole;
  client: ClientProfile | null;
}> {
  const [adminResult, clientResult] = await Promise.all([
    supabase.rpc('is_portal_admin'),
    supabase
      .from('clientes')
      .select('id, auth_id, nome, email, status')
      .eq('auth_id', user.id)
      .maybeSingle(),
  ]);

  if (adminResult.error) throw adminResult.error;
  if (adminResult.data === true) {
    return { role: 'admin', client: null };
  }

  const rawClient = clientResult.data;
  if (clientResult.error) throw clientResult.error;
  if (rawClient && (rawClient.status === 'ativo' || rawClient.status === null)) {
    return {
      role: 'client',
      client: {
        id: rawClient.id,
        authId: rawClient.auth_id,
        name: rawClient.nome,
        email: rawClient.email,
        status: rawClient.status ?? 'ativo',
      },
    };
  }

  if (rawClient) return { role: 'unassigned', client: null };

  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (membership) return { role: 'collaborator', client: null };

  return { role: 'unassigned', client: null };
}

export async function signInWithPassword(email: string, password: string) {
  try {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return error ? toUserMessage(error) : null;
  } catch (error) { return toUserMessage(error); }
}

export async function sendAccessLink(email: string) {
  try {
    // Uses the same invitation, email delivery and rate limit as the website.
    // The link opens the verified website; the new password works in both.
    const { error } = await supabase.functions.invoke('client-password-link', {
      body: { email: email.trim().toLowerCase() },
    });
    return error ? toUserMessage(error) : null;
  } catch (error) { return toUserMessage(error); }
}

export async function updatePassword(password: string) {
  try {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? toUserMessage(error) : null;
  } catch (error) { return toUserMessage(error); }
}
