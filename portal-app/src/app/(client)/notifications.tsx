import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { listNotifications, markNotificationRead } from '@/services/portal-service';
import { enablePushNotifications } from '@/services/push-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { NotificationSummary } from '@/types/domain';

export default function NotificationsScreen() {
  const router = useRouter();
  const { client } = useAuth();
  const { selectedProject } = useProject();
  const [items, setItems] = useState<NotificationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    const clientId = client?.id ?? selectedProject?.clientId;
    if (!clientId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const result = await listNotifications(clientId, selectedProject?.id);
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, [client?.id, selectedProject?.clientId, selectedProject?.id]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const markRead = async (item: NotificationSummary) => {
    const nextError = await markNotificationRead(item.id);
    if (nextError) setError(nextError);
    else setItems((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
  };

  const openNotification = async (item: NotificationSummary) => {
    if (!item.read) {
      const nextError = await markNotificationRead(item.id);
      if (nextError) {
        setError(nextError);
        return;
      }
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
    }
    if (item.linkPath?.startsWith('/(client)/')) router.push(item.linkPath as never);
  };

  const activatePush = async () => {
    setEnablingPush(true); setError(null); setSuccess(null);
    const nextError = await enablePushNotifications();
    setEnablingPush(false);
    if (nextError) setError(nextError);
    else setSuccess('Avisos ativados neste aparelho.');
  };

  return (
    <Screen>
      <PageHeader eyebrow="Atualizações" title="Notificações" description="Informações importantes relacionadas aos seus projetos." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {Platform.OS !== 'web' ? (
        <Card>
          <Text style={styles.title}>Receber avisos no celular</Text>
          <Text style={styles.message}>Ative para receber reuniões, solicitações, aprovações e novos arquivos mesmo quando o aplicativo estiver fechado.</Text>
          <Button loading={enablingPush} onPress={() => void activatePush()} title="Ativar notificações no celular" variant="secondary" />
        </Card>
      ) : null}
      {!loading && items.length === 0 ? (
        <StateView description="Novas atualizações aparecerão aqui." icon="notifications-outline" title="Nenhuma notificação" />
      ) : null}
      {items.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}>
            <Text style={styles.title}>{item.title}</Text>
            <StatusPill label={item.read ? 'Visualizada' : 'Nova'} tone={item.read ? 'success' : 'danger'} />
          </View>
          {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('pt-BR')}</Text>
          {item.linkPath?.startsWith('/(client)/') ? <Button onPress={() => void openNotification(item)} title={item.read ? 'Abrir atividade' : 'Visualizar agora'} variant="secondary" /> : null}
          {!item.read && !item.linkPath?.startsWith('/(client)/') ? <Button onPress={() => void markRead(item)} title="Marcar como lida" variant="secondary" /> : null}
        </Card>
      ))}
      {items.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar notificações" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1, color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  message: { color: colors.slate, fontSize: typography.size.body, lineHeight: 21, fontFamily: typography.family },
  date: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
});
