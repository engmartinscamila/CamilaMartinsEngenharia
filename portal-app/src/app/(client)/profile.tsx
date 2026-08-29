import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Notice, PageHeader, Screen, StatusPill } from '@/components/ui';
import { getDisplayName } from '@/lib/user-name';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { client, role, signOut, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const styles = useThemeStyles(styleDefinitions);
  const displayName = getDisplayName(user, client?.name);

  const exit = async () => {
    setLoading(true);
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      <PageHeader eyebrow="Conta e segurança" title="Perfil" description="Informações do seu acesso ao ecossistema Camila Martins Engenharia." />
      <Card>
        <View style={styles.header}>
          <Text style={styles.name}>{displayName}</Text>
          <StatusPill label={role === 'client' ? 'Cliente' : 'Colaborador'} tone="success" />
        </View>
        <View style={styles.divider} />
        <Row label="E-mail" value={user?.email ?? client?.email ?? 'Não informado'} />
        <Row label="Status" value={client?.status === 'ativo' ? 'Conta ativa' : 'Acesso vinculado por projeto'} />
      </Card>
      <Notice tone="info">Seus dados estão protegidos, assim como no site.</Notice>
      <Button icon="log-out-outline" loading={loading} onPress={() => void exit()} title="Sair com segurança" variant="danger" />
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '700', fontFamily: typography.family },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.xs },
  row: { gap: 3, paddingVertical: spacing.xs },
  label: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: typography.family },
  value: { color: colors.ink, fontSize: typography.size.body, lineHeight: 21, fontFamily: typography.family },
});
