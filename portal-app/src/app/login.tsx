import { type Href, Link, Redirect, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { TurnstileCaptcha } from '@/components/turnstile-captcha';
import { Button, Field, Notice } from '@/components/ui';
import { requestNativeCaptchaToken } from '@/lib/captcha';\nimport { env } from '@/lib/env';
import { safeAdminReturnPath } from '@/lib/auth-return-path';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export default function LoginScreen() {
  const styles = useThemeStyles(styleDefinitions);
  const { configured, loading: authLoading, session, role, signIn } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRequired = Platform.OS === 'web' && env.appEnvironment !== 'development';
  const captchaConfigurationMissing = captchaRequired && !env.isTurnstileConfigured;

  if (!authLoading && session) {
    const destination = role === 'admin' ? safeAdminReturnPath(returnTo) : null;
    return <Redirect href={(destination ?? '/') as Href} />;
  }

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }
    if (captchaConfigurationMissing) {
      setError('A verificação de segurança do portal não está configurada. O login web permanece bloqueado por segurança.');
      return;
    }
    let token = captchaToken;
    if (captchaRequired && Platform.OS !== 'web') {
      setLoading(true);
      const nativeCaptcha = await requestNativeCaptchaToken();
      if (nativeCaptcha.error || !nativeCaptcha.token) {
        setLoading(false);
        setError(nativeCaptcha.error ?? 'Conclua a verificação de segurança antes de entrar.');
        return;
      }
      token = nativeCaptcha.token;
    }
    if (captchaRequired && !token) {
      setError('Conclua a verificação de segurança antes de entrar.');
      return;
    }

    setLoading(true);
    const signInError = await signIn(email, password, token ?? undefined);
    setError(signInError);
    setLoading(false);

    if (Platform.OS === 'web') {
      setCaptchaToken(null);
      setCaptchaResetKey((current) => current + 1);
    }
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
        maxLength={254}
        onChangeText={setEmail}
        placeholder="seu@email.com"
        value={email}
      />
      <Field
        autoCapitalize="none"
        autoComplete="current-password"
        label="Senha"
        maxLength={256}
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

      {Platform.OS === 'web' && env.isTurnstileConfigured ? (
        <TurnstileCaptcha
          key={`turnstile-${captchaResetKey}`}
          onError={setCaptchaError}
          onTokenChange={setCaptchaToken}
          siteKey={env.turnstileSiteKey}
        />
      ) : null}
      {captchaConfigurationMissing ? (
        <Notice tone="danger">
          Proteção anti-robô indisponível. O login foi bloqueado até que o CAPTCHA seja configurado.
        </Notice>
      ) : null}
      {captchaError ? <Notice tone="danger">{captchaError}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        disabled={!configured || captchaConfigurationMissing || (Platform.OS === 'web' && captchaRequired && !captchaToken)}
        loading={loading}
        onPress={submit}
        title="Entrar"
      />
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
