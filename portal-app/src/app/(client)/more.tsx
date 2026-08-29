import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Notice, PageHeader, Screen } from '@/components/ui';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { getClientUnreadNotificationCount } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

const available = [
  { href: '/(client)/pending' as const, icon: 'alert-circle-outline' as const, title: 'Pendências', description: 'Tudo que aguarda uma ação sua' },
  { href: '/(client)/deliveries' as const, icon: 'checkbox-outline' as const, title: 'Entregas e checklist', description: 'Etapas concluídas e arquivos publicados' },
  { href: '/(client)/photos' as const, icon: 'images-outline' as const, title: 'Fotos e evolução', description: 'Registros visuais organizados por projeto' },
  { href: '/(client)/library' as const, icon: 'library-outline' as const, title: 'Biblioteca', description: 'Guias e materiais exclusivos' },
  { href: '/(client)/agenda' as const, icon: 'calendar-outline' as const, title: 'Agenda', description: 'Reuniões, visitas e compromissos' },
  { href: '/(client)/schedule' as const, icon: 'git-branch-outline' as const, title: 'Cronograma', description: 'Etapas, datas e evolução do projeto' },
  { href: '/(client)/approvals' as const, icon: 'checkmark-done-outline' as const, title: 'Aprovações', description: 'Decisões e histórico de respostas' },
  { href: '/(client)/requests' as const, icon: 'help-buoy-outline' as const, title: 'Suporte', description: 'Envie e acompanhe solicitações' },
  { href: '/(client)/notifications' as const, icon: 'notifications-outline' as const, title: 'Notificações', description: 'Atualizações lidas e não lidas' },
  { href: '/(client)/contact' as const, icon: 'chatbubbles-outline' as const, title: 'Falar com a equipe', description: 'Solicitação, WhatsApp e e-mail institucionais' },
  { href: '/(client)/privacy' as const, icon: 'shield-checkmark-outline' as const, title: 'Privacidade', description: 'LGPD, arquivos e segurança da sessão' },
  { href: '/(client)/profile' as const, icon: 'person-circle-outline' as const, title: 'Perfil e segurança', description: 'Dados da conta e sair' },
];

export default function MoreScreen() {
  const { client } = useAuth();
  const { revision } = useSync();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const loadUnread = useCallback(async () => {
    if (!client?.id) return setUnreadNotifications(0);
    const count = await getClientUnreadNotificationCount(client.id);
    if (count !== null) setUnreadNotifications(count);
  }, [client]);

  useEffect(() => {
    const task = setTimeout(() => void loadUnread(), 0);
    const interval = setInterval(() => void loadUnread(), 30_000);
    return () => { clearTimeout(task); clearInterval(interval); };
  }, [loadUnread, revision]);

  return (
    <Screen>
      <PageHeader eyebrow="Central de recursos" title="Mais" description="Acesso às áreas complementares do seu projeto." />
      {available.map((item) => (
        <Link asChild href={item.href} key={item.href}>
          <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.icon}><Ionicons color={colors.gold600} name={item.icon} size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            {item.href === '/(client)/notifications' && unreadNotifications > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications} nova{unreadNotifications === 1 ? '' : 's'}</Text></View>
            ) : null}
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        </Link>
      ))}
      <Card><Notice tone="info">Todos os módulos acima respeitam o projeto e o número de contrato selecionados.</Notice></Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  pressed: { opacity: 0.75 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft },
  title: { color: colors.ink, fontSize: typography.size.body, fontWeight: '700', fontFamily: typography.family },
  description: { color: colors.muted, fontSize: 12, marginTop: 3, fontFamily: typography.family },
  badge: { minHeight: 24, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.danger, paddingHorizontal: spacing.sm },
  badgeText: { color: colors.surface, fontSize: 10, fontWeight: '700', fontFamily: typography.family },
});
