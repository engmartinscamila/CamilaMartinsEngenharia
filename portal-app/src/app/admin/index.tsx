import { openWebsiteAdminHome, openWebsiteAdminSection, usesWebsiteAdminHome } from '@/lib/admin-navigation';
import { adminSections } from '@/lib/admin-sections';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { BrandMark, Button, Card, FullScreenLoader, Notice, PageHeader, Screen } from '@/components/ui';
import { AdminMenuRow, AdminNotificationBell } from '@/components/admin-ui';
import { SyncControl } from '@/components/sync-control';
import { ThemeSelector } from '@/components/theme-selector';
import { env } from '@/lib/env';
import { getDisplayName, getFirstName } from '@/lib/user-name';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { getDocumentArchiveReminder } from '@/services/document-archive-service';
import { listAdminDocumentAttention } from '@/services/document-workflow-service';
import { getAdminDashboard } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DashboardCounts } from '@/types/domain';

const initialCounts: DashboardCounts = { activeClients: null, activeProjects: null, openRequests: null, pendingApprovals: null };

export default function AdminDashboard() {
  const websiteHome = usesWebsiteAdminHome();
  useEffect(() => { if (websiteHome) openWebsiteAdminHome(); }, [websiteHome]);
  return websiteHome ? <FullScreenLoader /> : <MainAdminDashboard />;
}

function MainAdminDashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [counts, setCounts] = useState(initialCounts);
  const [attentionCount, setAttentionCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [archiveReminderCount, setArchiveReminderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const styles = useThemeStyles(styleDefinitions);
  const adminFirstName = getFirstName(getDisplayName(user, null, 'Camila'));

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, attentionResult, archiveResult] = await Promise.all([getAdminDashboard(), listAdminDocumentAttention(), getDocumentArchiveReminder(180)]);
    setCounts(dashboardResult.data);
    const actionable = attentionResult.data.filter((item) => item.attentionLevel !== 'normal' && item.formalNoticeStatus !== 'enviado');
    setAttentionCount(actionable.length);
    setOverdueCount(actionable.filter((item) => item.attentionLevel === 'overdue').length);
    setArchiveReminderCount(archiveResult.data);
    setError(dashboardResult.error ?? attentionResult.error ?? archiveResult.error);
    setLoading(false);
  }, []);

  useLiveRefresh(load);
  const exit = async () => { await signOut(); router.replace('/login'); };

  const metrics = [
    { key: 'clients', label: 'Clientes ativos', value: counts.activeClients, route: '/admin/clients' as const },
    { key: 'projects', label: 'Projetos ativos', value: counts.activeProjects, route: '/admin/projects' as const },
    { key: 'requests', label: 'Solicitações abertas', value: counts.openRequests, route: '/admin/requests' as const },
    { key: 'approvals', label: 'Aprovações pendentes', value: counts.pendingApprovals, route: '/admin/approvals' as const },
  ] as const;

  const modules = adminSections.map((section) => ({
    ...section,
    onPress: () => { if (!openWebsiteAdminSection(section.key)) router.push(section.href); },
  }));

  return (
    <Screen>
      <View style={[styles.topbar, isMobile && styles.topbarMobile]}>
        <BrandMark compact />
        {isMobile ? <View style={styles.mobileControls}><ThemeSelector compact /><View style={styles.mobileActionRow}><AdminNotificationBell /><SyncControl compact /><Button icon="log-out-outline" onPress={() => void exit()} title="Sair" variant="ghost" /></View></View> : <View style={styles.topbarActions}><ThemeSelector compact /><AdminNotificationBell /><SyncControl compact /><Button icon="log-out-outline" onPress={() => void exit()} title="Sair" variant="ghost" /></View>}
      </View>
      <PageHeader eyebrow="Administração" title={`Bem vinda, Engª ${adminFirstName}.`} description="Todas as áreas de gestão em um só lugar. Escolha uma função abaixo." />
      {env.isHomologation ? <Notice tone="info">Ambiente de homologação: os indicadores incluem as contas e os registros usados no teste de isolamento A/B.</Notice> : null}
      {attentionCount > 0 ? <Card><Notice tone={overdueCount > 0 ? 'danger' : 'warning'}>{overdueCount > 0 ? `${overdueCount} aprovação(ões) já ultrapassaram o prazo contratual de manifestação. Há ${attentionCount} pendência(s) que exigem sua atenção.` : `${attentionCount} aprovação(ões) estão a até 3 dias do fim do prazo contratual de manifestação.`}</Notice><Button onPress={() => { if (!openWebsiteAdminSection('contract-documents')) router.push('/admin/contract-documents'); }} title="Ver pendências contratuais" variant="secondary" /></Card> : null}
      {archiveReminderCount > 0 ? <Card><Notice tone="info">Há {archiveReminderCount} documento(s) com mais de 180 dias aptos para manutenção de Storage. Nenhum será apagado automaticamente.</Notice><Button onPress={() => { if (!openWebsiteAdminSection('document-archive')) router.push('/admin/document-archive'); }} title="Revisar arquivo documental" variant="secondary" /></Card> : null}
      {error ? <Notice tone="warning">{error} Valores indisponíveis não são exibidos como zero.</Notice> : null}
      <View style={[styles.metrics, isMobile && styles.metricsMobile]}>{metrics.map((metric) => <Pressable accessibilityRole="button" key={metric.label} onPress={() => { if (!openWebsiteAdminSection(metric.key)) router.push(metric.route); }} style={({ pressed }) => [styles.metricPressable, isMobile && styles.metricPressableMobile, pressed && styles.metricPressed]}><Card style={isMobile ? { ...styles.metric, ...styles.metricMobile } : styles.metric}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricValue}>{metric.value === null ? 'Indisponível' : metric.value}</Text><Text style={styles.metricLink}>Abrir</Text></Card></Pressable>)}</View>
      <View style={styles.moduleList}>{modules.map((module) => <AdminMenuRow compact={isMobile} description={module.description} icon={module.icon} key={module.key} onPress={module.onPress} title={module.title} />)}</View>
      <Button loading={loading} onPress={() => void load()} title="Atualizar indicadores" variant="secondary" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, topbarMobile: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs }, topbarActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }, mobileControls: { width: '100%', minWidth: 0, alignItems: 'stretch', gap: spacing.xs }, mobileActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metricsMobile: { gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: 180, minHeight: 112, justifyContent: 'space-between' }, metricMobile: { flexBasis: 136, minHeight: 92, padding: spacing.sm }, metricPressable: { flexGrow: 1, flexBasis: 180 }, metricPressableMobile: { flexBasis: 136 }, metricPressed: { opacity: 0.72 }, metricLabel: { color: colors.slate, fontSize: 12, fontWeight: '600', fontFamily: typography.family }, metricValue: { color: colors.ink, fontSize: 26, fontWeight: '700', fontFamily: typography.family }, metricLink: { color: colors.gold600, fontSize: 11, fontWeight: '700', fontFamily: typography.family }, moduleList: { gap: spacing.sm },
});
