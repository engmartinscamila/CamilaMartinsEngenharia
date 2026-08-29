import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, PageHeader } from '@/components/ui';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { useSync } from '@/providers/sync-provider';
import { getAdminUnreadNotificationCount } from '@/services/admin-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  const styles = useThemeStyles(styleDefinitions);
  const router = useRouter();
  return (
    <View style={styles.pageTop}>
      <View style={styles.headerActions}>
        <Button icon="arrow-back-outline" onPress={() => router.back()} title="Voltar" variant="ghost" />
        <AdminNotificationBell />
      </View>
      <PageHeader eyebrow="Administração" title={title} description={description} />
    </View>
  );
}

export function AdminNotificationBell() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { revision } = useSync();
  const styles = useThemeStyles(styleDefinitions);
  const [unread, setUnread] = useState<number | null>(null);

  const load = useCallback(async () => {
    setUnread(await getAdminUnreadNotificationCount());
  }, []);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    const interval = setInterval(() => void load(), 30_000);
    return () => { clearTimeout(task); clearInterval(interval); };
  }, [load, revision]);

  return (
    <Pressable
      accessibilityLabel={unread ? `${unread} notificações administrativas não lidas` : 'Abrir notificações administrativas'}
      accessibilityRole="button"
      onPress={() => router.push('/admin/notifications')}
      style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
    >
      <Ionicons color={unread ? colors.danger : colors.gold600} name={unread ? 'notifications' : 'notifications-outline'} size={21} />
      {unread ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
      <Text style={styles.notificationLabel}>Notificações</Text>
    </Pressable>
  );
}

export function SelectionChips<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable accessibilityRole="button" key={item.value} onPress={() => onChange(item.value)} style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AdminMenuRow({ icon, title, description, onPress, compact = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; onPress: () => void; compact?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menu, compact && styles.menuCompact, pressed && styles.pressed]}>
      <View style={[styles.menuIcon, compact && styles.menuIconCompact]}><Ionicons color={colors.gold600} name={icon} size={compact ? 20 : 22} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.menuTitle, compact && styles.menuTitleCompact]}>{title}</Text><Text style={styles.menuDescription}>{description}</Text></View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  pageTop: { gap: spacing.xs, alignItems: 'flex-start' },
  headerActions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  notificationButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  notificationBadge: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.danger, paddingHorizontal: 4 },
  notificationBadgeText: { color: colors.surface, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  notificationLabel: { color: colors.ink, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  group: { gap: spacing.xs },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  chipSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  chipText: { color: colors.slate, fontSize: 12, fontWeight: '600', fontFamily: typography.family },
  chipTextSelected: { color: colors.gold600 },
  menu: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  menuCompact: { minHeight: 68, padding: spacing.sm, gap: spacing.sm },
  menuIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft },
  menuIconCompact: { width: 38, height: 38, borderRadius: 19 },
  menuTitle: { color: colors.ink, fontSize: typography.size.body, fontWeight: '700', fontFamily: typography.family },
  menuTitleCompact: { fontSize: 14 },
  menuDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3, fontFamily: typography.family },
  pressed: { opacity: 0.75 },
});
