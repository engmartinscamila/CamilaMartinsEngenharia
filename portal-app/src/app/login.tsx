import { Link, Redirect } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button, Field, Notice } from '@/components/ui';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export default function LoginScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const { configured, loading: authLoading, session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && session) return <Redirect href="/" />;

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }
    setLoading(true);
    setError(await signIn(email, password));
    setLoading(false);
  };

  return (
    <AuthShell
      title="Bem-vinda à sua central."
      description="Acompanhe projetos, documentos e próximos passos em um só lugar."
    >
      {!configured ? (
        <Notice tone="warning">{env.configurationIssue ?? 'A conexão segura ainda não foi configurada.'}</Notice>
      ) : null}
      {configured && env.isHomologation ? (
        <Notice tone="warning">Ambiente de homologação: use somente as contas fictícias de teste.</Notice>
      ) : null}
      <Field
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        label="E-mail"
        onChangeText={setEmail}
        placeholder="seu@email.com"
        value={email}
      />
      <Field
        autoCapitalize="none"
        autoComplete="current-password"
        label="Senha"
        onChangeText={setPassword}
        placeholder="Sua senha"
        secureTextEntry={!showPassword}
        value={password}
      />
      <Pressable
        accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
        accessibilityRole="button"
        onPress={() => setShowPassword((current) => !current)}
        style={styles.passwordToggle}
      >
        <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Text>
      </Pressable>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button disabled={!configured} loading={loading} onPress={submit} title="Entrar" />
      <View style={styles.links}>
        <Link asChild href="/first-access">
          <Pressable accessibilityRole="link"><Text style={styles.link}>Primeiro acesso</Text></Pressable>
        </Link>
        <Link asChild href="/forgot-password">
          <Pressable accessibilityRole="link"><Text style={styles.link}>Esqueci minha senha</Text></Pressable>
        </Link>
      </View>
      <Text style={styles.caption}>Não existe cadastro público. O acesso é liberado pela equipe.</Text>
    </AuthShell>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  passwordToggle: { alignSelf: 'flex-end', marginTop: -spacing.sm, paddingVertical: 4, paddingHorizontal: 2 },
  passwordToggleText: { color: colors.gold600, fontWeight: '700', fontSize: 12, fontFamily: typography.family },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  link: { color: colors.gold600, fontWeight: '700', fontSize: 13, fontFamily: typography.family },
  caption: { color: colors.muted, fontSize: typography.size.caption, lineHeight: 18, textAlign: 'center', fontFamily: typography.family },
});
