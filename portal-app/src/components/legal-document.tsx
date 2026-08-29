import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Button, Card, PageHeader, Screen } from '@/components/ui';
import type { LegalSection } from '@/lib/legal';
import { useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export function LegalDocument({
  title,
  eyebrow,
  description,
  version,
  effectiveDate,
  sections,
}: {
  title: string;
  eyebrow: string;
  description: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
}) {
  const router = useRouter();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <Screen>
      <Button icon="arrow-back-outline" onPress={() => router.back()} title="Voltar" variant="ghost" />
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Text style={styles.version}>Versão {version} • Vigência: {effectiveDate}</Text>
      {sections.map((section) => (
        <Card key={section.title}>
          <Text style={styles.title}>{section.title}</Text>
          <View style={styles.paragraphs}>
            {section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  version: { color: colors.muted, fontFamily: typography.family, fontSize: 11 },
  title: { color: colors.ink, fontFamily: typography.family, fontSize: typography.size.bodyLarge, fontWeight: '700' },
  paragraphs: { gap: spacing.sm },
  body: { color: colors.slate, fontFamily: typography.family, fontSize: typography.size.body, lineHeight: 23 },
});
