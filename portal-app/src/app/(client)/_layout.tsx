import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ClientQuickControls } from '@/components/client-quick-controls';
import { FullScreenLoader, Screen, ScreenTopInsetProvider, StateView } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { ProjectProvider } from '@/providers/project-provider';
import { useLegal } from '@/providers/legal-provider';
import { useSync } from '@/providers/sync-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { getClientUnreadNotificationCount } from '@/services/portal-service';
import { typography } from '@/theme/tokens';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  project: 'business-outline',
  documents: 'document-text-outline',
  requests: 'chatbox-ellipses-outline',
  more: 'grid-outline',
};

export default function ClientLayout() {
  const { colors } = useAppTheme();
  const { client, loading, role, session, signOut } = useAuth();
  const { accepted, loading: legalLoading } = useLegal();
  const { revision } = useSync();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!client?.id) {
      setUnreadNotifications(0);
      return;
    }
    const count = await getClientUnreadNotificationCount(client.id);
    if (count !== null) setUnreadNotifications(count);
  }, [client]);

  useEffect(() => {
    const task = setTimeout(() => void loadUnread(), 0);
    const interval = setInterval(() => void loadUnread(), 30_000);
    return () => { clearTimeout(task); clearInterval(interval); };
  }, [loadUnread, revision]);

  if (loading || (session && legalLoading)) return <FullScreenLoader />;
  if (!session) return <Redirect href="/login" />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if ((role === 'client' || role === 'collaborator') && !accepted) return <Redirect href="/legal-acceptance" />;
  if (role !== 'client' && role !== 'collaborator') {
    return (
      <Screen>
        <StateView
          actionLabel="Sair"
          description="Sua conta existe, mas ainda não está vinculada a um projeto ativo. Solicite a liberação à equipe."
          icon="lock-closed-outline"
          onAction={() => void signOut()}
          title="Acesso ainda não liberado"
        />
      </Screen>
    );
  }

  return (
    <ProjectProvider>
      <View style={{ flex: 1 }}>
        <ClientQuickControls />
        <ScreenTopInsetProvider enabled={false}>
          <Tabs
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: colors.gold600,
              tabBarInactiveTintColor: colors.muted,
              tabBarLabelStyle: { fontFamily: typography.family, fontSize: 10, fontWeight: '600' },
              tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64, paddingTop: 6, paddingBottom: 8 },
              tabBarHideOnKeyboard: true,
              tabBarIcon: ({ color, size }) => <Ionicons color={color} name={icons[route.name] ?? 'ellipse-outline'} size={size} />,
            })}
          >
            <Tabs.Screen name="home" options={{ title: 'Início' }} />
            <Tabs.Screen name="project" options={{ title: 'Projeto' }} />
            <Tabs.Screen name="documents" options={{ title: 'Documentos' }} />
            <Tabs.Screen name="requests" options={{ title: 'Solicitações' }} />
            <Tabs.Screen name="more" options={{
              title: 'Mais',
              tabBarBadge: unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.surface, fontFamily: typography.family },
            }} />
            <Tabs.Screen name="notifications" options={{ href: null }} />
            <Tabs.Screen name="profile" options={{ href: null }} />
            <Tabs.Screen name="photos" options={{ href: null }} />
            <Tabs.Screen name="library" options={{ href: null }} />
            <Tabs.Screen name="agenda" options={{ href: null }} />
            <Tabs.Screen name="schedule" options={{ href: null }} />
            <Tabs.Screen name="approvals" options={{ href: null }} />
            <Tabs.Screen name="pending" options={{ href: null }} />
            <Tabs.Screen name="deliveries" options={{ href: null }} />
            <Tabs.Screen name="privacy" options={{ href: null }} />
            <Tabs.Screen name="contact" options={{ href: null }} />
          </Tabs>
        </ScreenTopInsetProvider>
      </View>
    </ProjectProvider>
  );
}
