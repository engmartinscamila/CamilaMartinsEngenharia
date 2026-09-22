import { Redirect, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import React from 'react';

import { FullScreenLoader, Screen, StateView } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { safeAdminReturnPath } from '@/lib/auth-return-path';

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const { loading, role, session } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ projectId?: string; tipo?: string; section?: string }>();
  const query = new URLSearchParams();
  for (const key of ['projectId', 'tipo', 'section'] as const) {
    if (typeof params[key] === 'string') query.set(key, params[key]);
  }
  const returnTo = safeAdminReturnPath(`${pathname}?${query}`);

  if (loading) return <FullScreenLoader />;
  if (!session) return <Redirect href={returnTo ? { pathname: '/login', params: { returnTo } } : '/login'} />;
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
      <Stack.Screen name="commercial-documents" />
      <Stack.Screen name="crm" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="work-diary" />
      <Stack.Screen name="procurement" />
      <Stack.Screen name="portal-control" />
      <Stack.Screen name="contract-documents" />
      <Stack.Screen name="document-preparation" />
      <Stack.Screen name="document-governance" />
      <Stack.Screen name="document-archive" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="construction-schedule" />
      <Stack.Screen name="construction-schedule-new" />
      <Stack.Screen name="construction-schedule-revision" />
      <Stack.Screen name="construction-schedule-budget" />
      <Stack.Screen name="construction-schedule-measurements" />
      <Stack.Screen name="construction-schedule-baselines" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="financial" />
      <Stack.Screen name="security" />
      <Stack.Screen name="system-health" />
    </Stack>
  );
}
