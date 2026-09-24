import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

function isoToDate(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateToIso(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.group}>
        <Text style={styles.label}>{label}{optional ? ' (opcional)' : ''}</Text>
        <TextInput
          accessibilityLabel={label}
          onChangeText={onChange}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={value}
          {...({ type: 'date' } as object)}
        />
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}{optional ? ' (opcional)' : ''}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={styles.input}
      >
        <Text style={value ? styles.value : styles.placeholder}>{value || 'Selecionar data'}</Text>
      </Pressable>
      {value && optional ? (
        <Pressable accessibilityRole="button" onPress={() => onChange('')}>
          <Text style={styles.clear}>Limpar data</Text>
        </Pressable>
      ) : null}
      {open ? (
        <NativeDateTimePicker
          mode="date"
          presentation="dialog"
          value={selected}
          onValueChange={(_event, nextDate) => {
            if (nextDate) onChange(dateToIso(nextDate));
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  group: { gap: spacing.xs },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700' as const, fontFamily: typography.family },
  input: {
    minHeight: 46,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.family,
    fontSize: 14,
  },
  value: { color: colors.ink, fontSize: 14, fontFamily: typography.family },
  placeholder: { color: colors.muted, fontSize: 14, fontFamily: typography.family },
  clear: { color: colors.gold600, fontSize: 12, fontWeight: '600' as const, fontFamily: typography.family },
});
