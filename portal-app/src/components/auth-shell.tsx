import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui';
import { useThemeStyles } from '@/providers/theme-provider';
import { layout, radius, shadow, spacing, ThemeColors, typography } from '@/theme/tokens';

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <BrandMark />
            <View style={styles.card}>
              <Text style={styles.eyebrow}>CENTRAL DIGITAL DO CLIENTE</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
              <View style={styles.form}>{children}</View>
            </View>
            <Text style={styles.footer}>Projetos • Técnica • Aprovação</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  safe: { flex: 1, backgroundColor: colors.navy900 },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, width: '100%', maxWidth: layout.maxFormWidth, alignSelf: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...(shadow as object) },
  eyebrow: { color: colors.gold600, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, fontFamily: typography.family },
  title: { color: colors.ink, fontSize: 26, lineHeight: 33, fontWeight: '700', fontFamily: typography.family },
  description: { color: colors.slate, fontSize: typography.size.body, lineHeight: 22, fontFamily: typography.family },
  form: { marginTop: spacing.sm, gap: spacing.md },
  footer: { color: colors.gold300, fontSize: 11, letterSpacing: 1, textAlign: 'center', fontFamily: typography.family },
});
