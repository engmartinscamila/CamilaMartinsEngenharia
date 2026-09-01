import type { User } from '@supabase/supabase-js';

import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { signInFirebaseBridge, updateFirebasePasswordBridge } from '@/services/firebase-bridge';
import type { AppRole, ClientProfile } from '@/types/domain';

export async function resolveIdentity(user: User): Promise<{
  role: AppRole;
  client: ClientProfile | null;
}> {
  // A regra de administrador pertence ao banco de produção. Usar a RPC evita
  // duplicar regras no aplicativo e, principalmente, evita comparar o UUID do
  // Auth com o id BIGINT da tabela legada `usuarios`.
  const adminRpc = await supabase.rpc('is_portal_admin');
  if (!adminRpc.error && adminRpc.data === true) {
    return { role: 'admin', client: null };
  }

  // Fallback compatível com ambientes antigos. A política de `pdf_admins`
  // permite que o usuário autenticado consulte somente o próprio registro.
  const adminFallback = await supabase
    .from('pdf_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminFallback.data) {
    return { role: 'admin', client: null };
  }

  const clientResult = await supabase
    .from('clientes')
    .select('id, auth_id, nome, email, status')
    .eq('auth_id', user.id)
    .maybeSingle();

  const rawClient = clientResult.data;
  // O backend considera registros legados sem status como ativos. O app deve
  // aplicar o mesmo contrato para não bloquear clientes antigos por engano.
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

  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id, role')
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

  await signInFirebaseBridge(normalizedEmail, password);
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

  await updateFirebasePasswordBridge(password);
  return null;
}
