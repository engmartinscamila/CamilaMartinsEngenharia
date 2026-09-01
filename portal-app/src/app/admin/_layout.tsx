import { Redirect, Stack } from 'expo-router';
import React from 'react';

import { FullScreenLoader, Screen, StateView } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { loading, role, session } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Redirect href="/login" />;
  if (role === 'client' || role === 'collaborator') return <Redirect href="/(client)/home" />;
  if (role !== 'admin') {
    return (
      <Screen>
        <StateView description="Esta área exige um perfil administrativo validado no banco." icon="shield-outline" title="Acesso administrativo negado" />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="content" />
      <Stack.Screen name="contract-documents" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="financial" />
      <Stack.Screen name="security" />
    </Stack>
  );
}
