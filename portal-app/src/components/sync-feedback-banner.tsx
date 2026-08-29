import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { useSync } from '@/providers/sync-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export function SyncFeedbackBanner() {
  const { colors } = useAppTheme();
  const { lastSyncedAt, status } = useSync();
  const [hiddenSuccessKey, setHiddenSuccessKey] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);
  const statusKey = `${status}:${lastSyncedAt ?? ''}`;

  useEffect(() => {
    if (status !== 'success') return;
    const task = setTimeout(() => setHiddenSuccessKey(statusKey), 6000);
    return () => clearTimeout(task);
  }, [status, statusKey]);

  const formattedTime = useMemo(() => lastSyncedAt
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncedAt))
    : null, [lastSyncedAt]);

  if (status === 'idle' || (status === 'success' && hiddenSuccessKey === statusKey)) return null;

  const message = status === 'syncing'
    ? 'Sincronizando Portal e aplicativo…'
    : status === 'success'
      ? `Sincronização concluída${formattedTime ? ` às ${formattedTime}` : ''}. Portal e aplicativo estão atualizados.`
      : status === 'offline'
        ? 'Sem internet. Nenhum dado foi substituído.'
        : 'Não foi possível sincronizar. Verifique a conexão e tente novamente.';
  const icon = status === 'success' ? 'checkmark-circle-outline' : status === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline';

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[
        styles.banner,
        status === 'success' && styles.success,
        (status === 'offline' || status === 'error') && styles.error,
      ]}
    >
      {status === 'syncing'
        ? <ActivityIndicator color={colors.info} size="small" />
        : <Ionicons color={status === 'success' ? colors.success : colors.danger} name={icon} size={18} />}
      <Text style={[
        styles.text,
        status === 'success' && styles.successText,
        (status === 'offline' || status === 'error') && styles.errorText,
      ]}>{message}</Text>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  banner: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.infoSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.info,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  success: { backgroundColor: colors.successSoft, borderBottomColor: colors.success },
  error: { backgroundColor: colors.dangerSoft, borderBottomColor: colors.danger },
  text: { color: colors.info, fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  successText: { color: colors.success },
  errorText: { color: colors.danger },
});
