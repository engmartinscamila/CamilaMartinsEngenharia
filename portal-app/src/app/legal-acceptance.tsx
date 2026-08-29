import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, FullScreenLoader, Notice, PageHeader, Screen } from '@/components/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal';
import { useAuth } from '@/providers/auth-provider';
import { useLegal } from '@/providers/legal-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

function CheckRow({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.checkRow, checked && styles.checkRowSelected, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
        {checked ? <Ionicons color={colors.navy950} name="checkmark" size={18} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function LegalAcceptanceScreen() {
  const router = useRouter();
  const styles = useThemeStyles(styleDefinitions);
  const { loading: authLoading, role, session } = useAuth();
  const { accept, accepted, accepting, error, loading, refresh } = useLegal();
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  if (authLoading || loading) return <FullScreenLoader label="Validando primeiro acesso…" />;
  if (!session) return <Redirect href="/login" />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if (accepted) return <Redirect href="/(client)/home" />;

  const confirm = async () => {
    if (await accept()) router.replace('/(client)/home');
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Primeiro acesso"
        title="Documentos do aplicativo"
        description="Leia os documentos e confirme cada item separadamente para continuar."
      />
      <Card>
        <Text style={styles.title}>Termos de Uso</Text>
        <Text style={styles.body}>Versão {CURRENT_TERMS_VERSION}. Regras de acesso, uso, documentos e materiais autorais.</Text>
        <Button onPress={() => router.push('/terms-of-use')} title="Ler Termos de Uso" variant="secondary" />
      </Card>
      <Card>
        <Text style={styles.title}>Política de Privacidade</Text>
        <Text style={styles.body}>Versão {CURRENT_PRIVACY_VERSION}. Como os dados são usados, protegidos e conservados.</Text>
        <Button onPress={() => router.push('/privacy-policy')} title="Ler Política de Privacidade" variant="secondary" />
      </Card>
      <View style={styles.checks}>
        <CheckRow checked={termsChecked} label="Li e aceito os Termos de Uso." onPress={() => setTermsChecked((value) => !value)} />
        <CheckRow checked={privacyChecked} label="Li e estou ciente da Política de Privacidade." onPress={() => setPrivacyChecked((value) => !value)} />
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {error ? <Button onPress={() => void refresh()} title="Tentar validar novamente" variant="secondary" /> : null}
      <Button
        disabled={!termsChecked || !privacyChecked || Boolean(error)}
        loading={accepting}
        onPress={() => void confirm()}
        title="Confirmar e continuar"
      />
      <Notice tone="info">O aceite dos Termos e a ciência da Política são registrados com usuário, versões, data, plataforma e versão do aplicativo.</Notice>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  body: { color: colors.slate, fontFamily: typography.family, fontSize: 13, lineHeight: 20 },
  checks: { gap: spacing.sm },
  checkRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  checkRowSelected: { borderColor: colors.gold500, backgroundColor: colors.warningSoft },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.gold600, borderRadius: radius.sm },
  checkboxSelected: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  checkLabel: { flex: 1, color: colors.ink, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 21 },
  pressed: { opacity: 0.75 },
});
