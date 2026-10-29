import { Redirect, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import React from 'react';
import {Platform,ScrollView,View,useWindowDimensions} from 'react-native';
import {AdminGroupedMenu} from '@/components/admin-ui';

import { BrandMark, FullScreenLoader, Screen, StateView } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { safeAdminReturnPath } from '@/lib/auth-return-path';

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const {width}=useWindowDimensions();
  const { loading, role, session } = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ projectId?: string; tipo?: string; section?: string; view?:string; filter?:string; q?:string; financialId?:string; clientId?:string }>();
  const query = new URLSearchParams();
  for (const key of ['projectId', 'tipo', 'section', 'view', 'filter', 'q', 'financialId', 'clientId'] as const) {
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

  const content = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="workspace" />
      <Stack.Screen name="receipts" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="website-content" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="works-center" />
      <Stack.Screen name="finance-center" />
      <Stack.Screen name="asset-center" />
      <Stack.Screen name="client-center" />
      <Stack.Screen name="relationship-center" />
      <Stack.Screen name="settings-center" />
      <Stack.Screen name="content" />
      <Stack.Screen name="commercial-documents" />
      <Stack.Screen name="crm" />
      <Stack.Screen name="document-center" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="work-diary" />
      <Stack.Screen name="procurement" />
      <Stack.Screen name="portal-control" />
      <Stack.Screen name="contract-documents" />
      <Stack.Screen name="document-preparation" />
      <Stack.Screen name="document-governance" />
      <Stack.Screen name="service-level-governance" />
      <Stack.Screen name="document-archive" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="construction-schedule" />
      <Stack.Screen name="construction-schedule-new" />
      <Stack.Screen name="construction-schedule-test" />
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
  if(Platform.OS!=='web'||width<=820)return content;
  return <View style={{flex:1,flexDirection:'row',backgroundColor:colors.background}}>
    <View nativeID="cmePortalAdminSidebar" style={{width:280,flexShrink:0,borderRightWidth:1,borderRightColor:colors.line,backgroundColor:colors.background}}>
      <ScrollView contentContainerStyle={{padding:16,gap:20}}><BrandMark /><AdminGroupedMenu key={pathname+':'+(params.tipo??'')} /></ScrollView>
    </View>
    <View style={{flex:1,minWidth:0}}>{content}</View>
  </View>;
}
