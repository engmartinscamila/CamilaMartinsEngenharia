import React from 'react';
import { Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Card, PageHeader, Screen, StateView, StatusPill } from '@/components/ui';
import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

function Detail({ label, value }: { label: string; value: string }) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function ProjectScreen() {
  const { selectedProject, projects } = useProject();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Screen>
      <PageHeader eyebrow="Seu escopo" title="Projeto" description="Informações organizadas por contrato, sem misturar contratações." />
      <ProjectPicker />
      {!selectedProject && projects.length === 0 ? (
        <StateView description="Ainda não existe um projeto vinculado à sua conta." icon="business-outline" title="Projeto não disponível" />
      ) : null}
      {selectedProject ? (
        <Card>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contract}>CONTRATO {selectedProject.contractNumber}</Text>
              <Text style={styles.title}>{selectedProject.name}</Text>
            </View>
            <StatusPill label={selectedProject.status} tone={selectedProject.status === 'ativo' ? 'success' : 'neutral'} />
          </View>
          <View style={styles.divider} />
          <Detail label="Tipo de serviço" value={selectedProject.serviceType ?? 'Não informado'} />
          <Detail label="Progresso" value={selectedProject.progress === null ? 'Indisponível' : `${selectedProject.progress}%`} />
          <Detail label="Local" value={[selectedProject.city, selectedProject.state].filter(Boolean).join(' • ') || 'Não informado'} />
          <Detail label="Identificação técnica" value={selectedProject.id} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  contract: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 20, marginTop: 4, fontWeight: '700', fontFamily: typography.family },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.xs },
  detail: { gap: 3, paddingVertical: spacing.xs },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: typography.family },
  value: { color: colors.ink, fontSize: typography.size.body, lineHeight: 21, fontFamily: typography.family },
});
