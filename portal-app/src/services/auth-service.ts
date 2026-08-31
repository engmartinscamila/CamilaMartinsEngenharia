import type { User } from '@supabase/supabase-js';

import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { signInFirebaseBridge, updateFirebasePasswordBridge } from '@/services/firebase-bridge';
import type { AppRole, ClientProfile } from '@/types/domain';

export async function resolveIdentity(user: User): Promise<{
  role: AppRole;
  client: ClientProfile | null;
}> {
  const [adminResult, userResult, clientResult] = await Promise.all([
    supabase.from('pdf_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('usuarios').select('tipo').eq('id', user.id).maybeSingle(),
    supabase
      .from('clientes')
      .select('id, auth_id, nome, email, status')
      .eq('auth_id', user.id)
      .maybeSingle(),
  ]);

  if (adminResult.data || userResult.data?.tipo === 'administrador') {
    return { role: 'admin', client: null };
  }

  const rawClient = clientResult.data;
  if (rawClient?.status === 'ativo') {
    return {
      role: 'client',
      client: {
        id: rawClient.id,
        authId: rawClient.auth_id,
        name: rawClient.nome,
        email: rawClient.email,
        status: rawClient.status,
      },
    };
  }

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
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) return toUserMessage(error);

  void signInFirebaseBridge(normalizedEmail, password);
  return null;
}

export async function sendAccessLink(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  return error ? toUserMessage(error) : null;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return toUserMessage(error);

  void updateFirebasePasswordBridge(password);
  return null;
}
