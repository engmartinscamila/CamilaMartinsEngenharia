import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, ThemeMode, typography } from '@/theme/tokens';

const options: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { mode: 'light', label: 'Claro', icon: 'sunny-outline' },
  { mode: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.wrapper}>
      {!compact ? <Text style={styles.label}>APARÊNCIA</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.mode === mode;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.mode}
              onPress={() => void setMode(option.mode)}
              style={({ pressed }) => [styles.option, compact && styles.optionCompact, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <Ionicons color={selected ? colors.navy950 : colors.gold600} name={option.icon} size={compact ? 14 : 16} />
              <Text style={[styles.optionText, compact && styles.optionTextCompact, selected && styles.optionTextSelected]}>
                {compact && option.mode === 'system' ? 'Auto' : option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!compact ? <Text style={styles.help}>A escolha fica salva neste aparelho. “Automático” acompanha o sistema.</Text> : null}
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  wrapper: { gap: spacing.xs },
  label: { color: colors.gold600, fontFamily: typography.family, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  optionCompact: { minHeight: 34, gap: 4, paddingHorizontal: 7, paddingVertical: 5 },
  optionSelected: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  optionText: { color: colors.slate, fontFamily: typography.family, fontSize: 12, fontWeight: '600' },
  optionTextCompact: { fontSize: 10 },
  optionTextSelected: { color: colors.navy950 },
  help: { color: colors.muted, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.74 },
});
