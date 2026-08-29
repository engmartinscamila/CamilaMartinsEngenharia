import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { AuthShell } from '@/components/auth-shell';
import { Button, Field, Notice } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { changePassword, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!session) {
      setError('Este link não é mais válido. Solicite um novo link de acesso.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    const nextError = await changePassword(password);
    setLoading(false);
    if (nextError) setError(nextError);
    else router.replace('/');
  };

  return (
    <AuthShell title="Defina uma nova senha." description="Escolha uma senha exclusiva para proteger seu acesso.">
      <Field
        autoComplete="new-password"
        label="Nova senha"
        onChangeText={setPassword}
        placeholder="Mínimo de 8 caracteres"
        secureTextEntry
        value={password}
      />
      <Field
        autoComplete="new-password"
        label="Confirmar nova senha"
        onChangeText={setConfirmation}
        placeholder="Digite a senha novamente"
        secureTextEntry
        value={confirmation}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button loading={loading} onPress={submit} title="Salvar nova senha" />
    </AuthShell>
  );
}
