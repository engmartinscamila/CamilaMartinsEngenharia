import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { AdminPageHeader } from '@/components/admin-ui';
import { Button, Card, Field, Notice, Screen, StateView, StatusPill } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import {
  createAdminNotification,
  listAdminActivityNotifications,
  listAdminNotifications,
  listAdminProjects,
  markAdminNotificationRead,
} from '@/services/admin-service';
import { enablePushNotifications } from '@/services/push-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AdminNotificationSummary, AdminProjectSummary } from '@/types/domain';

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [items, setItems] = useState<AdminNotificationSummary[]>([]);
  const [activity, setActivity] = useState<AdminNotificationSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('atualizacao');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    setLoading(true);
    const [projectResult, notificationResult, activityResult] = await Promise.all([listAdminProjects(), listAdminNotifications(), listAdminActivityNotifications()]);
    setProjects(projectResult.data);
    setItems(notificationResult.data);
    setActivity(activityResult.data);
    setSelectedProjectId((current) => current ?? projectResult.data[0]?.id ?? null);
    setError(projectResult.error ?? notificationResult.error ?? activityResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const create = async () => {
    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project || title.trim().length < 3 || message.trim().length < 3) { setError('Selecione o projeto e preencha título e mensagem.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    const result = await createAdminNotification({ project, title, message, type });
    setSaving(false);
    if (result) setError(result);
    else { setTitle(''); setMessage(''); setSuccess('Notificação interna criada para o projeto.'); await load(); }
  };

  const openActivity = async (item: AdminNotificationSummary) => {
    setError(null);
    if (!item.read) {
      const nextError = await markAdminNotificationRead(item.id);
      if (nextError) {
        setError(nextError);
        return;
      }
      setActivity((current) => current.map((row) => row.id === item.id ? { ...row, read: true } : row));
    }
    if (item.linkPath?.startsWith('/admin/')) router.push(item.linkPath as never);
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
      <AdminPageHeader description="Crie avisos internos vinculados ao cliente e ao projeto corretos." title="Notificações internas" />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Novidades para administrar</Text>
        <StatusPill label={`${activity.filter((item) => !item.read).length} nova${activity.filter((item) => !item.read).length === 1 ? '' : 's'}`} tone={activity.some((item) => !item.read) ? 'danger' : 'success'} />
      </View>
      {!loading && activity.length === 0 ? <StateView description="Solicitações e respostas novas aparecerão aqui automaticamente." icon="checkmark-circle-outline" title="Nenhuma novidade" /> : null}
      {activity.map((item) => (
        <Card key={item.id}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.clientName} • {item.projectName} • {formatDate(item.createdAt)}</Text></View>
            <StatusPill label={item.read ? 'Visualizada' : 'Nova'} tone={item.read ? 'success' : 'danger'} />
          </View>
          {item.message ? <Text style={styles.body}>{item.message}</Text> : null}
          <Button onPress={() => void openActivity(item)} title={item.read ? 'Abrir atividade' : 'Visualizar agora'} variant="secondary" />
        </Card>
      ))}
      {Platform.OS !== 'web' ? (
        <Card>
          <Text style={styles.sectionTitle}>Avisos neste celular</Text>
          <Text style={styles.body}>Ative para receber solicitações e respostas mesmo quando o aplicativo estiver fechado.</Text>
          <Button loading={enablingPush} onPress={() => void activatePush()} title="Ativar notificações no celular" variant="secondary" />
        </Card>
      ) : null}
      <Card>
        <Text style={styles.sectionTitle}>Enviar aviso ao cliente</Text>
        <Text style={styles.label}>Projeto e contrato</Text>
        <View style={styles.projectList}>{projects.map((project) => <Pressable key={project.id} onPress={() => setSelectedProjectId(project.id)} style={[styles.projectChip, selectedProjectId === project.id && styles.selected]}><Text style={[styles.projectText, selectedProjectId === project.id && styles.selectedText]}>{project.contractNumber} • {project.name} • {project.clientName}</Text></Pressable>)}</View>
        <Field label="Tipo" onChangeText={setType} value={type} />
        <Field label="Título" onChangeText={setTitle} value={title} />
        <Field label="Mensagem" multiline onChangeText={setMessage} style={styles.message} value={message} />
        <Button loading={saving} onPress={() => void create()} title="Criar notificação interna" />
        <Notice tone="info">O aviso aparece imediatamente na central interna. No celular, o push depende da ativação do aparelho e do vínculo Expo/EAS.</Notice>
      </Card>
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      <Text style={styles.sectionTitle}>Avisos enviados aos clientes</Text>
      {!loading && items.length === 0 ? <StateView description="Nenhum aviso foi enviado." icon="notifications-outline" title="Sem avisos enviados" /> : null}
      {items.map((item) => <Card key={item.id}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.meta}>{item.clientName} • {item.projectName} • {formatDate(item.createdAt)}</Text></View><StatusPill label={item.read ? 'Lida' : 'Não lida'} tone={item.read ? 'success' : 'warning'} /></View>{item.message ? <Text style={styles.body}>{item.message}</Text> : null}</Card>)}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, label: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  projectList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, projectChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm }, selected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft }, projectText: { color: colors.slate, fontSize: 12, fontFamily: typography.family }, selectedText: { color: colors.gold600, fontWeight: '700' },
  message: { minHeight: 100, textAlignVertical: 'top' }, header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family }, meta: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: typography.family }, body: { color: colors.slate, fontSize: 13, lineHeight: 20, fontFamily: typography.family },
});
