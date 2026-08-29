import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Card, Notice, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAgenda, listApprovals, listRequests } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

interface PendingItem {
  key: string;
  title: string;
  description: string;
  count: number;
  route: '/(client)/approvals' | '/(client)/requests' | '/(client)/agenda';
}

export default function PendingScreen() {
  const router = useRouter();
  const { selectedProject } = useProject();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    const [approvals, requests, agenda] = await Promise.all([
      listApprovals(selectedProject.id),
      listRequests(selectedProject.id),
      listAgenda(selectedProject.id, selectedProject.clientId),
    ]);
    const pendingApprovals = approvals.data.filter((item) => item.status === 'aguardando').length;
    const waitingRequests = requests.data.filter((item) => item.status === 'aguardando_cliente').length;
    const meetingsToConfirm = agenda.data.filter((item) => ['needsAction', 'pending', 'aguardando'].includes(item.invitationStatus)).length;
    const nextItems: PendingItem[] = [
      { key: 'approvals', title: 'Aprovações', description: 'Decisões que aguardam sua resposta.', count: pendingApprovals, route: '/(client)/approvals' },
      { key: 'requests', title: 'Solicitações', description: 'Conversas que aguardam uma informação sua.', count: waitingRequests, route: '/(client)/requests' },
      { key: 'agenda', title: 'Agenda', description: 'Compromissos que ainda precisam de confirmação.', count: meetingsToConfirm, route: '/(client)/agenda' },
    ];
    setItems(nextItems.filter((item) => item.count > 0));
    setError(approvals.error ?? requests.error ?? agenda.error);
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  return (
    <Screen>
      <PageHeader eyebrow="Precisa da sua atenção" title="Pendências" description="Tudo que depende de uma ação sua, reunido por contrato e projeto." />
      <ProjectPicker />
      {error ? <Notice tone="warning">Algumas pendências não puderam ser conferidas agora.</Notice> : null}
      {!loading && selectedProject && items.length === 0 ? (
        <Card><StateView description="Você não possui nenhuma ação pendente neste projeto." icon="checkmark-circle-outline" title="Tudo certo por aqui" /></Card>
      ) : null}
      {items.map((item) => (
        <Card key={item.key}>
          <View style={styles.header}><Text style={styles.title}>{item.title}</Text><StatusPill label={`${item.count} pendente${item.count === 1 ? '' : 's'}`} tone="warning" /></View>
          <Text style={styles.description}>{item.description}</Text>
          <Button onPress={() => router.push(item.route)} title={`Abrir ${item.title.toLowerCase()}`} variant="secondary" />
        </Card>
      ))}
      <Button loading={loading} onPress={() => void load()} title="Atualizar pendências" variant="ghost" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1, color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  description: { color: colors.slate, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 21 },
});
