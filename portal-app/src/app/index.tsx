import { Redirect } from 'expo-router';
import React from 'react';

import { FullScreenLoader, Screen, StateView } from '@/components/ui';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/auth-provider';
import { useLegal } from '@/providers/legal-provider';

export default function EntryRoute() {
  const { configured, loading, session, role, signOut } = useAuth();
  const { accepted, loading: legalLoading } = useLegal();

  if (loading || (session && role !== 'admin' && legalLoading)) return <FullScreenLoader />;
  if (!configured) {
    return (
      <Screen>
        <StateView
          icon="settings-outline"
          title="Conexão pendente"
          description={env.configurationIssue ?? 'Configure a URL do serviço e a chave pública no arquivo de ambiente.'}
        />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/login" />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if (role === 'client' || role === 'collaborator') {
    return accepted ? <Redirect href="/(client)/home" /> : <Redirect href="/legal-acceptance" />;
  }

  return (
    <Screen>
      <StateView
        actionLabel="Sair"
        description="Sua conta está autenticada, mas ainda não possui um perfil administrativo nem vínculo com um projeto ativo. Solicite a liberação à equipe."
        icon="lock-closed-outline"
        onAction={() => void signOut()}
        title="Acesso ainda não liberado"
      />
    </Screen>
  );
}
