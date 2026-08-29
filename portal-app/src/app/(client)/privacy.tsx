import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, Notice, PageHeader, Screen } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { PRIVACY_CONTACT_EMAIL } from '@/lib/legal';
import { useAuth } from '@/providers/auth-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { ThemeColors, typography } from '@/theme/tokens';

export default function PrivacyScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Screen>
      <PageHeader eyebrow="LGPD e segurança" title="Privacidade" description="Como este aplicativo limita e protege o uso dos seus dados." />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <Text style={styles.title}>Dados e finalidade</Text>
        <Text style={styles.body}>Seus dados são usados para confirmar o acesso, executar os serviços contratados e apresentar somente os clientes e projetos autorizados para sua conta.</Text>
      </Card>
      <Card>
        <Text style={styles.title}>Arquivos e acesso</Text>
        <Text style={styles.body}>Documentos e imagens seguem permissões definidas por conta e projeto. Materiais técnicos e autorais podem ter consulta controlada, identificação ou marca d’água.</Text>
      </Card>
      <Card>
        <Text style={styles.title}>Proteção da conta</Text>
        <Text style={styles.body}>O acesso é individual. Mantenha sua senha e seu aparelho protegidos, não compartilhe a conta e use “Sair com segurança” quando deixar de utilizar um dispositivo.</Text>
      </Card>
      <Card>
        <Text style={styles.title}>Seus direitos</Text>
        <Text style={styles.body}>Para solicitar acesso, correção, informações ou outra providência prevista na LGPD, use um dos canais abaixo. A identidade do solicitante poderá ser confirmada para proteger seus dados.</Text>
        {role === 'client' ? (
          <Button
            onPress={() => router.push({ pathname: '/(client)/requests', params: { assunto: 'Privacidade e dados pessoais' } })}
            title="Abrir solicitação"
            variant="secondary"
          />
        ) : null}
        <Button
          onPress={() => void openExternalUrl(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=Privacidade%20e%20dados%20pessoais`, ['mailto']).then(setError)}
          title="Enviar e-mail de privacidade"
          variant="secondary"
        />
      </Card>
      <Card>
        <Text style={styles.title}>Documentos completos</Text>
        <Text style={styles.body}>Consulte quando quiser as versões vigentes dos documentos apresentados no primeiro acesso.</Text>
        <Button onPress={() => router.push('/privacy-policy')} title="Ler Política de Privacidade" variant="secondary" />
        <Button onPress={() => router.push('/terms-of-use')} title="Ler Termos de Uso" variant="secondary" />
      </Card>
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  title: { color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  body: { color: colors.slate, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 22 },
});
