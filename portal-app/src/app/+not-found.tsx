import { useRouter } from 'expo-router';
import React from 'react';

import { Screen, StateView } from '@/components/ui';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <StateView
        actionLabel="Voltar ao início"
        description="O endereço pode ter mudado ou você não possui acesso a este conteúdo."
        icon="compass-outline"
        onAction={() => router.replace('/')}
        title="Página não encontrada"
      />
    </Screen>
  );
}
