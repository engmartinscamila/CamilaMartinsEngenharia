import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncControl } from '@/components/sync-control';
import { ThemeSelector } from '@/components/theme-selector';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { getClientUnreadNotificationCount } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

export function ClientQuickControls() {
  const router = useRouter();
  const { client } = useAuth();
  const { revision } = useSync();
  const { colors } = useAppTheme();
  const [unread, setUnread] = useState(0);
  const styles = useThemeStyles(styleDefinitions);

  const loadUnread = useCallback(async () => {
    if (!client?.id) return setUnread(0);
    const count = await getClientUnreadNotificationCount(client.id);
    if (count !== null) setUnread(count);
  }, [client]);

  useEffect(() => {
    const task = setTimeout(() => void loadUnread(), 0);
    const interval = setInterval(() => void loadUnread(), 30_000);
    return () => { clearTimeout(task); clearInterval(interval); };
  }, [loadUnread, revision]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View accessibilityLabel="Aparência, notificações e sincronização" style={styles.bar}>
        <ThemeSelector compact />
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={unread ? `${unread} notificações não visualizadas` : 'Abrir notificações'}
            accessibilityRole="button"
            onPress={() => router.push('/(client)/notifications')}
            style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
          >
            <Ionicons color={unread ? colors.danger : colors.gold600} name={unread ? 'notifications' : 'notifications-outline'} size={20} />
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
            <Text style={styles.notificationLabel}>Notificações</Text>
          </Pressable>
          <SyncControl compact />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  safeArea: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  bar: {
    width: '100%',
    maxWidth: 1120,
    minHeight: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  notificationButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  badge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.danger, paddingHorizontal: 4 },
  badgeText: { color: colors.surface, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  notificationLabel: { color: colors.ink, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
