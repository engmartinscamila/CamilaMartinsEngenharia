import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Notice, PageHeader, Screen } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { useThemeStyles } from '@/providers/theme-provider';
import { ThemeColors, typography } from '@/theme/tokens';

const emailUrl = 'mailto:eng.martins.camila@gmail.com';
const whatsappUrl = 'https://wa.me/5521986429999';

export default function ContactScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Screen>
      <PageHeader eyebrow="Atendimento" title="Falar com a equipe" description="Escolha o canal adequado para manter o histórico do seu projeto organizado." />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <Text style={styles.title}>Assunto do projeto</Text>
        <Text style={styles.body}>Solicitações internas ficam vinculadas ao contrato e podem ser acompanhadas por você e pela administração.</Text>
        <Button onPress={() => router.push('/(client)/requests')} title="Abrir solicitação" />
      </Card>
      <Card>
        <Text style={styles.title}>Canais institucionais</Text>
        <Button icon="logo-whatsapp" onPress={() => void openExternalUrl(whatsappUrl).then(setError)} title="WhatsApp institucional" variant="secondary" />
        <Button icon="mail-outline" onPress={() => void openExternalUrl(emailUrl, ['mailto']).then(setError)} title="Enviar e-mail" variant="secondary" />
      </Card>
      <Notice tone="info">Para alterações, aprovações, entregas e dúvidas técnicas, prefira a solicitação interna para preservar o registro.</Notice>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  body: { color: colors.slate, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 22 },
});
