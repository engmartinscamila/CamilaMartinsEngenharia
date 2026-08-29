import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { formatDate, formatTime, humanizeStatus } from '@/lib/format';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { listAgenda, respondToAgenda } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { AgendaSummary } from '@/types/domain';

export default function AgendaScreen() {
  const { selectedProject } = useProject();
  const [items, setItems] = useState<AgendaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listAgenda(selectedProject.id, selectedProject.clientId);
    setItems(result.data);
    setError(result.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const openMeeting = async (url: string) => {
    setError(await openExternalUrl(url));
  };

  const respond = async (item: AgendaSummary, status: 'accepted' | 'declined') => {
    setRespondingId(item.id);
    setError(null);
    setSuccess(null);
    const nextError = await respondToAgenda(item.id, status);
    setRespondingId(null);
    if (nextError) setError(nextError);
    else {
      setSuccess(status === 'accepted' ? 'Presença confirmada.' : 'Ausência informada à equipe.');
      await load();
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Compromissos" title="Agenda" description="Reuniões, visitas e eventos relacionados ao projeto selecionado." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && selectedProject && items.length === 0 ? (
        <StateView actionLabel="Atualizar" description="Quando houver uma reunião ou visita agendada, ela aparecerá aqui." icon="calendar-outline" onAction={() => void load()} title="Nenhum compromisso futuro" />
      ) : null}
      {items.map((item) => {
        const day = new Date(`${item.date}T12:00:00`).getDate();
        const month = new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const start = formatTime(item.startTime);
        const end = formatTime(item.endTime);
        return (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={styles.dateBox}><Text style={styles.day}>{day}</Text><Text style={styles.month}>{month}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>{formatDate(item.date)}{start ? ` • ${start}${end ? `–${end}` : ''}` : ''}</Text>
                {item.eventType ? <Text style={styles.type}>{item.eventType}</Text> : null}
              </View>
              <StatusPill label={humanizeStatus(item.invitationStatus)} tone={item.invitationStatus === 'accepted' ? 'success' : item.invitationStatus === 'declined' ? 'danger' : 'warning'} />
            </View>
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            {['needsAction', 'pending', 'aguardando'].includes(item.invitationStatus) ? (
              <View style={styles.actions}>
                <View style={styles.action}><Button loading={respondingId === item.id} onPress={() => void respond(item, 'accepted')} title="Confirmar presença" /></View>
                <View style={styles.action}><Button disabled={respondingId === item.id} onPress={() => void respond(item, 'declined')} title="Não poderei participar" variant="secondary" /></View>
              </View>
            ) : null}
            {item.meetingUrl ? <Button icon="videocam-outline" onPress={() => void openMeeting(item.meetingUrl!)} title="Entrar na reunião" variant="secondary" /> : null}
          </Card>
        );
      })}
      {items.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar agenda" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBox: { width: 58, height: 62, borderRadius: radius.md, backgroundColor: colors.navy900, alignItems: 'center', justifyContent: 'center' },
  day: { color: colors.surface, fontSize: 23, fontWeight: '700', fontFamily: typography.family },
  month: { color: colors.gold300, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', fontFamily: typography.family },
  title: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4, fontFamily: typography.family },
  type: { color: colors.gold600, fontSize: 11, marginTop: 3, fontWeight: '600', fontFamily: typography.family },
  description: { color: colors.slate, fontSize: 13, lineHeight: 19, fontFamily: typography.family },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 170 },
});
