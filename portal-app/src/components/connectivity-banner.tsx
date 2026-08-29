import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import React from 'react';
import { Text, View } from 'react-native';

import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { spacing, ThemeColors, typography } from '@/theme/tokens';

export function ConnectivityBanner() {
  const { colors } = useAppTheme();
  const network = Network.useNetworkState();
  const styles = useThemeStyles(styleDefinitions);
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Ionicons color={colors.warning} name="cloud-offline-outline" size={17} />
      <Text style={styles.text}>Você está sem conexão. As informações podem não estar atualizadas e arquivos privados não são salvos offline.</Text>
    </View>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.warningSoft, borderBottomWidth: 1, borderBottomColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  text: { flex: 1, maxWidth: 1180, color: colors.warning, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
});
