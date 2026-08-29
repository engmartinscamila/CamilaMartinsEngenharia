import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { useSync } from '@/providers/sync-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

function syncMessage(status: ReturnType<typeof useSync>['status'], realtimeConnected: boolean) {
  if (status === 'offline') return 'Sem internet. Nenhum dado foi substituído.';
  if (status === 'error') return 'Não foi possível sincronizar. Tente novamente.';
  if (status === 'success') return 'Dados conferidos com o Portal.';
  return realtimeConnected ? 'Atualização automática ativa.' : 'Conectando à atualização automática…';
}

export function SyncControl({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();
  const { lastSyncedAt, realtimeConnected, status, syncNow } = useSync();
  const styles = useThemeStyles(styleDefinitions);
  const syncing = status === 'syncing';
  const formattedTime = lastSyncedAt
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncedAt))
    : null;
  const fullMessage = syncMessage(status, realtimeConnected);

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {!compact ? <Text style={styles.label}>SINCRONIZAÇÃO</Text> : null}
      <Pressable
        accessibilityLabel="Sincronizar dados com o Portal"
        accessibilityRole="button"
        accessibilityState={{ busy: syncing, disabled: syncing }}
        disabled={syncing}
        onPress={() => void syncNow()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, syncing && styles.disabled]}
      >
        {syncing ? <ActivityIndicator color={colors.gold600} size="small" /> : <Ionicons color={colors.gold600} name="sync-outline" size={17} />}
        <Text style={styles.buttonText}>{syncing ? 'Sincronizando…' : 'Sincronizar'}</Text>
      </Pressable>
      {!compact ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.help,
            status === 'success' && styles.helpSuccess,
            status === 'error' || status === 'offline' ? styles.helpError : null,
          ]}
        >
          {`${fullMessage}${formattedTime ? ` Última sincronização: ${formattedTime}.` : ''}`}
        </Text>
      ) : null}
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  wrapper: { gap: spacing.xs },
  wrapperCompact: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.gold600, fontFamily: typography.family, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  button: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.gold600, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  buttonText: { color: colors.gold600, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  help: { color: colors.muted, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  helpSuccess: { color: colors.success },
  helpError: { color: colors.danger },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.62 },
});
