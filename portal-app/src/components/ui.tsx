import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { layout, radius, shadow, spacing, ThemeColors, typography } from '@/theme/tokens';

const ScreenTopInsetContext = React.createContext(true);

export function ScreenTopInsetProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  return <ScreenTopInsetContext.Provider value={enabled}>{children}</ScreenTopInsetContext.Provider>;
}

export function BrandMark({ compact = false, small = false }: { compact?: boolean; small?: boolean }) {
  const styles = useThemeStyles(styleDefinitions);
  if (compact) {
    return (
      <View style={[styles.wordmark, small && styles.wordmarkSmall]} accessibilityLabel="Camila Martins Engenharia Civil">
        <Text style={[styles.wordmarkSignature, small && styles.wordmarkSignatureSmall]}>Camila Martins</Text>
        <Text style={[styles.wordmarkDescriptor, small && styles.wordmarkDescriptorSmall]}>ENGENHARIA CIVIL</Text>
      </View>
    );
  }
  return (
    <View style={styles.officialBrand} accessibilityLabel="Camila Martins Engenharia Civil">
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={require('../../assets/images/official-mark-transparent.png')}
        style={styles.officialBrandImage}
      />
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const styles = useThemeStyles(styleDefinitions);
  const topInsetEnabled = React.useContext(ScreenTopInsetContext);
  const content = <View style={[styles.screenContent, style]}>{children}</View>;
  return (
    <SafeAreaView edges={topInsetEnabled ? ['top'] : []} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.pageHeader}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={styles.pageTitle}>{title}</Text>
      {description ? <Text style={styles.pageDescription}>{description}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useThemeStyles(styleDefinitions);
  return <View style={[styles.card, style]}>{children}</View>;
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon }: ButtonProps) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && !blocked && styles.buttonPressed,
        blocked && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.navy950 : colors.gold600} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              color={variant === 'primary' ? colors.navy950 : variant === 'danger' ? colors.danger : colors.gold600}
              name={icon}
              size={18}
            />
          ) : null}
          <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
}

export function Field({ label, error, style, ...props }: FieldProps) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.field, error ? styles.fieldError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={[styles.notice, styles[`notice_${tone}`]]} accessibilityRole="alert">
      <Text style={[styles.noticeText, styles[`noticeText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function StateView({
  title,
  description,
  icon = 'information-circle-outline',
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons color={colors.gold600} name={icon} size={24} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export function FullScreenLoader({ label = 'Carregando com segurança…' }: { label?: string }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);
  return (
    <SafeAreaView style={styles.loader}>
      <BrandMark />
      <ActivityIndicator color={colors.gold500} size="small" />
      <Text style={styles.loaderText}>{label}</Text>
    </SafeAreaView>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const styles = useThemeStyles(styleDefinitions);
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  screenContent: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  officialBrand: {
    width: 118,
    height: 118,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  officialBrandImage: { width: '100%', height: '100%' },
  wordmark: {
    minWidth: 184,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  wordmarkSmall: { minWidth: 146, minHeight: 52 },
  wordmarkSignature: {
    color: colors.ink,
    fontFamily: typography.signature,
    fontSize: 29,
    lineHeight: 40,
  },
  wordmarkSignatureSmall: { fontSize: 22, lineHeight: 30 },
  wordmarkDescriptor: {
    color: colors.gold600,
    fontFamily: typography.family,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 2.2,
    lineHeight: 13,
  },
  wordmarkDescriptorSmall: { fontSize: 7, letterSpacing: 1.8, lineHeight: 10 },
  pageHeader: { gap: spacing.xs, marginBottom: spacing.xs },
  eyebrow: { color: colors.gold600, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, fontFamily: typography.family },
  pageTitle: { color: colors.ink, fontSize: typography.size.title, fontWeight: '700', lineHeight: 31, fontFamily: typography.family },
  pageDescription: { color: colors.slate, fontSize: typography.size.body, lineHeight: 22, fontFamily: typography.family },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...(shadow as object),
  },
  button: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
  },
  button_primary: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.gold500 },
  button_danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontWeight: '700', fontSize: typography.size.body, fontFamily: typography.family },
  buttonText_primary: { color: colors.navy950 },
  buttonText_secondary: { color: colors.gold600 },
  buttonText_danger: { color: colors.danger },
  buttonText_ghost: { color: colors.gold600 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.ink, fontWeight: '600', fontSize: 13, fontFamily: typography.family },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.body,
    fontFamily: typography.family,
  },
  fieldError: { borderColor: colors.danger },
  fieldErrorText: { color: colors.danger, fontSize: typography.size.caption, fontFamily: typography.family },
  notice: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  notice_info: { backgroundColor: colors.infoSoft, borderColor: colors.info },
  notice_success: { backgroundColor: colors.successSoft, borderColor: colors.success },
  notice_warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  notice_danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  noticeText: { fontSize: 13, lineHeight: 19, fontFamily: typography.family },
  noticeText_info: { color: colors.info },
  noticeText_success: { color: colors.success },
  noticeText_warning: { color: colors.warning },
  noticeText_danger: { color: colors.danger },
  state: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  stateIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: colors.ink, fontSize: typography.size.bodyLarge, fontWeight: '700', textAlign: 'center', fontFamily: typography.family },
  stateDescription: { color: colors.slate, fontSize: typography.size.body, lineHeight: 22, textAlign: 'center', maxWidth: 520, fontFamily: typography.family },
  loader: { flex: 1, backgroundColor: colors.navy900, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loaderText: { color: colors.gold300, fontSize: 13, fontFamily: typography.family },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.background },
  pill_neutral: { backgroundColor: colors.background },
  pill_success: { backgroundColor: colors.successSoft },
  pill_warning: { backgroundColor: colors.warningSoft },
  pill_danger: { backgroundColor: colors.dangerSoft },
  pillText: { fontSize: 11, fontWeight: '700', fontFamily: typography.family },
  pillText_neutral: { color: colors.slate },
  pillText_success: { color: colors.success },
  pillText_warning: { color: colors.warning },
  pillText_danger: { color: colors.danger },
});
