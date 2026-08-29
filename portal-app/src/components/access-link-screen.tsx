import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button, Field, Notice } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { ThemeColors, typography } from '@/theme/tokens';

export function AccessLinkScreen({ firstAccess = false }: { firstAccess?: boolean }) {
  const styles = useThemeStyles(styleDefinitions);
  const { configured, requestAccessLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    const nextError = await requestAccessLink(email);
    setLoading(false);
    setError(nextError);
    setSent(!nextError);
  };

  return (
    <AuthShell
      title={firstAccess ? 'Crie sua senha de acesso.' : 'Recupere seu acesso.'}
      description={
        firstAccess
          ? 'Use o mesmo e-mail autorizado pela equipe. Você receberá um link seguro para definir sua senha.'
          : 'Enviaremos um link seguro para o e-mail cadastrado.'
      }
    >
      <Field
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        label="E-mail autorizado"
        onChangeText={setEmail}
        placeholder="seu@email.com"
        value={email}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {sent ? (
        <Notice tone="success">
          Se este e-mail estiver autorizado, as instruções chegarão em alguns minutos. Verifique também a pasta de spam.
        </Notice>
      ) : null}
      <Button disabled={!configured} loading={loading} onPress={submit} title="Enviar link seguro" />
      <Link asChild href="/login">
        <Pressable accessibilityRole="link"><Text style={styles.link}>Voltar para entrar</Text></Pressable>
      </Link>
    </AuthShell>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  link: { color: colors.gold600, textAlign: 'center', fontWeight: '700', fontSize: 13, fontFamily: typography.family },
});
