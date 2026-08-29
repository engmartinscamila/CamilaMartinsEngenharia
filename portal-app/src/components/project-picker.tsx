import React from 'react';
import { ScrollView, Text, Pressable } from 'react-native';

import { useProject } from '@/providers/project-provider';
import { useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

export function ProjectPicker() {
  const styles = useThemeStyles(styleDefinitions);
  const { projects, selectedProject, selectProject } = useProject();
  if (projects.length < 2) return null;

  return (
    <ScrollView
      accessibilityLabel="Selecionar contrato e projeto"
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {projects.map((project) => {
        const selected = project.id === selectedProject?.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={project.id}
            onPress={() => void selectProject(project.id)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text numberOfLines={1} style={[styles.contract, selected && styles.textSelected]}>
              {project.contractNumber}
            </Text>
            <Text numberOfLines={1} style={[styles.project, selected && styles.textSelected]}>
              {project.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  content: { gap: spacing.xs, paddingVertical: 2 },
  option: { width: 180, paddingHorizontal: spacing.sm, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.gold500, backgroundColor: colors.navy900 },
  contract: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, fontFamily: typography.family },
  project: { color: colors.ink, marginTop: 3, fontSize: 13, fontWeight: '600', fontFamily: typography.family },
  textSelected: { color: colors.gold300 },
});
