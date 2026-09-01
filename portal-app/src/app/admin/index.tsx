import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { AdminMenuRow, AdminNotificationBell } from '@/components/admin-ui';
import { DailyQuote } from '@/components/daily-quote';
import { BrandMark, Button, Card, Notice, PageHeader, Screen } from '@/components/ui';
import { SyncControl } from '@/components/sync-control';
import { ThemeSelector } from '@/components/theme-selector';
import { env } from '@/lib/env';
import { getDisplayName, getFirstName } from '@/lib/user-name';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { listAdminProjects } from '@/services/admin-service';
import { getAdminDashboard } from '@/services/portal-service';
import { spacing, ThemeColors, typography } from '@/theme/tokens';
import type { DashboardCounts } from '@/types/domain';

const initialCounts: DashboardCounts = { activeClients: null, activeProjects: null, openRequests: null, pendingApprovals: null };
const activeProjectStatuses = new Set(['ativo', 'em_andamento']);

export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [counts, setCounts] = useState(initialCounts);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const styles = useThemeStyles(styleDefinitions);
  const adminFirstName = getFirstName(getDisplayName(user, null, 'Camila'));

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, projectResult] = await Promise.all([getAdminDashboard(), listAdminProjects()]);
    setCounts({
      ...dashboardResult.data,
      activeProjects: projectResult.error
        ? dashboardResult.data.activeProjects
        : projectResult.data.filter((project) => activeProjectStatuses.has(project.status)).length,
    });
    setError(dashboardResult.error ?? projectResult.error);
    setLoading(false);
  }, []);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);
  const exit = async () => { await signOut(); router.replace('/login'); };

  const metrics = [
    { label: 'Clientes ativos', value: counts.activeClients, route: '/admin/clients' as const },
    { label: 'Projetos ativos', value: counts.activeProjects, route: '/admin/projects' as const },
    { label: 'Solicitações abertas', value: counts.openRequests, route: '/admin/requests' as const },
    { label: 'Aprovações pendentes', value: counts.pendingApprovals, route: '/admin/approvals' as const },
  ] as const;

  const modules = [
    { key: 'clients', onPress: () => router.push('/admin/clients'), icon: 'people-outline' as const, title: 'Clientes e acessos', description: 'Cadastros, parcerias, acessos e histórico.' },
    { key: 'projects', onPress: () => router.push('/admin/projects'), icon: 'briefcase-outline' as const, title: 'Contratos e projetos', description: 'Cadastro inseparável pelo número do contrato e acompanhamento.' },
    { key: 'documents', onPress: () => router.push({ pathname: '/admin/content', params: { tipo: 'document' } }), icon: 'documents-outline' as const, title: 'Documentos', description: 'Arquivos técnicos organizados por projeto e categoria.' },
    { key: 'photos', onPress: () => router.push({ pathname: '/admin/content', params: { tipo: 'photo' } }), icon: 'images-outline' as const, title: 'Fotos e evolução da obra', description: 'Registros fotográficos protegidos e vinculados aos projetos.' },
    { key: 'library', onPress: () => router.push({ pathname: '/admin/content', params: { tipo: 'library' } }), icon: 'library-outline' as const, title: 'Biblioteca', description: 'Guias, catálogos e materiais exclusivos organizados por projeto.' },
    { key: 'financial', onPress: () => router.push('/admin/financial'), icon: 'receipt-outline' as const, title: 'Extrato financeiro (somente admin)', description: 'Valores, vencimentos, pagamentos, filtros e histórico preservado.' },
    { key: 'agenda', onPress: () => router.push('/admin/agenda'), icon: 'calendar-outline' as const, title: 'Agenda', description: 'Compromissos vinculados aos projetos.' },
    { key: 'schedule', onPress: () => router.push('/admin/schedule'), icon: 'git-branch-outline' as const, title: 'Cronogramas', description: 'Etapas, ordem, status e progresso.' },
    { key: 'approvals', onPress: () => router.push('/admin/approvals'), icon: 'checkmark-done-outline' as const, title: 'Aprovações', description: 'Criar decisões para resposta dos clientes.' },
    { key: 'requests', onPress: () => router.push('/admin/requests'), icon: 'chatbubbles-outline' as const, title: 'Solicitações', description: 'Atender, responder e atualizar o andamento.' },
    { key: 'notifications', onPress: () => router.push('/admin/notifications'), icon: 'notifications-outline' as const, title: 'Notificações internas', description: 'Avisos direcionados por cliente, contrato e projeto.' },
    { key: 'security', onPress: () => router.push('/admin/security'), icon: 'shield-checkmark-outline' as const, title: 'Segurança', description: 'Armazenamento utilizado, controles e trilha de auditoria.' },
  ];

  return <Screen>
    <View style={[styles.topbar, isMobile && styles.topbarMobile]}><BrandMark compact />{isMobile ? <View style={styles.mobileControls}><ThemeSelector compact /><View style={styles.mobileActionRow}><AdminNotificationBell /><SyncControl compact /><Button icon="log-out-outline" onPress={() => void exit()} title="Sair" variant="ghost" /></View></View> : <View style={styles.topbarActions}><ThemeSelector compact /><AdminNotificationBell /><SyncControl compact /><Button icon="log-out-outline" onPress={() => void exit()} title="Sair" variant="ghost" /></View>}</View>
    <PageHeader eyebrow="Administração" title={`Olá, ${adminFirstName}.`} description="Visão geral dos clientes, projetos e atividades do aplicativo." />
    <DailyQuote />
    {env.isHomologation ? <Notice tone="info">Ambiente de homologação: os indicadores incluem as contas e os registros usados no teste de isolamento A/B.</Notice> : null}
    {error ? <Notice tone="warning">{error} Valores indisponíveis não são exibidos como zero.</Notice> : null}
    <View style={[styles.metrics, isMobile && styles.metricsMobile]}>{metrics.map((metric) => <Pressable accessibilityHint={`Abrir ${metric.label.toLowerCase()}`} accessibilityRole="button" key={metric.label} onPress={() => router.push(metric.route)} style={({ pressed }) => [styles.metricPressable, isMobile && styles.metricPressableMobile, pressed && styles.metricPressed]}><Card style={isMobile ? { ...styles.metric, ...styles.metricMobile } : styles.metric}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricValue}>{metric.value === null ? 'Indisponível' : metric.value}</Text><Text style={styles.metricLink}>Abrir área</Text></Card></Pressable>)}</View>
    <View style={styles.moduleList}>{modules.map((module) => <AdminMenuRow compact={isMobile} description={module.description} icon={module.icon} key={module.key} onPress={module.onPress} title={module.title} />)}</View>
    <Button loading={loading} onPress={() => void load()} title="Atualizar indicadores" variant="secondary" />
  </Screen>;
}

const styleDefinitions = (colors: ThemeColors) => ({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, topbarMobile: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs }, topbarActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }, mobileControls: { width: '100%', minWidth: 0, alignItems: 'stretch', gap: spacing.xs }, mobileActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metricsMobile: { gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: 180, minHeight: 112, justifyContent: 'space-between' }, metricMobile: { flexBasis: 136, minHeight: 92, padding: spacing.sm }, metricPressable: { flexGrow: 1, flexBasis: 180 }, metricPressableMobile: { flexBasis: 136 }, metricPressed: { opacity: 0.72 }, metricLabel: { color: colors.slate, fontSize: 12, fontWeight: '600', fontFamily: typography.family }, metricValue: { color: colors.ink, fontSize: 26, fontWeight: '700', fontFamily: typography.family }, metricLink: { color: colors.gold600, fontSize: 11, fontWeight: '700', fontFamily: typography.family }, moduleList: { gap: spacing.sm },
});
