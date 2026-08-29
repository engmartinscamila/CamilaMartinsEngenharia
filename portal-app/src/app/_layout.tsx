import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/providers/auth-provider';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { PushNotificationBridge } from '@/components/push-notification-bridge';
import { SyncFeedbackBanner } from '@/components/sync-feedback-banner';
import { SyncProvider } from '@/providers/sync-provider';
import { LegalProvider } from '@/providers/legal-provider';
import { ThemeProvider, useAppTheme } from '@/providers/theme-provider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider><ThemedApplication /></ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApplication() {
  const { colors, resolvedMode } = useAppTheme();
  return (
    <AuthProvider>
      <LegalProvider>
        <SyncProvider><SynchronizedApplication backgroundColor={colors.background} statusBarStyle={resolvedMode === 'dark' ? 'light' : 'dark'} /></SyncProvider>
      </LegalProvider>
    </AuthProvider>
  );
}

function SynchronizedApplication({ backgroundColor, statusBarStyle }: { backgroundColor: string; statusBarStyle: 'light' | 'dark' }) {
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar style={statusBarStyle} />
      <ConnectivityBanner />
      <SyncFeedbackBanner />
      <PushNotificationBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="first-access" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="legal-acceptance" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-of-use" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}
