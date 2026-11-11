import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';

function isoToDate(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Converte AAAA-MM-DD para DD/MM/AAAA; outros textos ficam como estão. */
export function isoToBrazilian(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Máscara DD/MM/AAAA. Data completa e existente vira AAAA-MM-DD; o restante segue como digitado. */
export function brazilianDateInput(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
  if (digits.length !== 8) return { masked, iso: '' };
  const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  const check = new Date(`${iso}T12:00:00`);
  const valid = !Number.isNaN(check.getTime()) && dateToIso(check) === iso;
  return { masked, iso: valid ? iso : '' };
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
  const styles = useThemeStyles(styleDefinitions);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);

  if (Platform.OS === 'web') {
    return <WebDateField label={label} value={value} onChange={onChange} optional={optional} />;
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
        <Text style={value ? styles.value : styles.placeholder}>{value ? isoToBrazilian(value) : 'Selecionar data'}</Text>
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

/** Web: digitação sempre em DD/MM/AAAA (o campo nativo do navegador segue o idioma do sistema). */
function WebDateField({ label, value, onChange, optional }: { label: string; value: string; onChange: (value: string) => void; optional: boolean }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const [text, setText] = useState(() => isoToBrazilian(value));
  const lastEmitted = useRef(value);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(isoToBrazilian(value));
    }
  }, [value]);

  const emit = (next: string) => {
    lastEmitted.current = next;
    onChange(next);
  };
  const handleText = (input: string) => {
    const { masked, iso } = brazilianDateInput(input);
    setText(masked);
    // Data completa vai como AAAA-MM-DD; incompleta ou inexistente segue como texto para a validação da tela.
    emit(iso || masked);
  };
  const openCalendar = () => {
    const picker = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker) return;
    try {
      if (picker.showPicker) picker.showPicker();
      else picker.click();
    } catch {
      picker.click();
    }
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}{optional ? ' (opcional)' : ''}</Text>
      <View style={styles.webRow}>
        <TextInput
          accessibilityLabel={`${label} (DD/MM/AAAA)`}
          inputMode="numeric"
          maxLength={10}
          onChangeText={handleText}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.webInput]}
          value={text}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir calendário: ${label}`} onPress={openCalendar} style={styles.calendarButton}>
          <Text style={styles.calendarText}>Calendário</Text>
          {React.createElement('input', {
            ref: pickerRef,
            type: 'date',
            tabIndex: -1,
            'aria-hidden': true,
            value: /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '',
            onChange: (event: { target: { value: string } }) => {
              const iso = event.target.value;
              setText(isoToBrazilian(iso));
              emit(iso);
            },
            style: { position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', width: '100%', height: '100%' },
          })}
        </Pressable>
      </View>
      {text && optional ? (
        <Pressable accessibilityRole="button" onPress={() => { setText(''); emit(''); }}>
          <Text style={styles.clear}>Limpar data</Text>
        </Pressable>
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
  webRow: { flexDirection: 'row' as const, gap: spacing.xs, alignItems: 'stretch' as const },
  webInput: { flex: 1 },
  calendarButton: {
    position: 'relative' as const,
    minHeight: 46,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  calendarText: { color: colors.gold600, fontSize: 12, fontWeight: '700' as const, fontFamily: typography.family },
  clear: { color: colors.gold600, fontSize: 12, fontWeight: '600' as const, fontFamily: typography.family },
});
