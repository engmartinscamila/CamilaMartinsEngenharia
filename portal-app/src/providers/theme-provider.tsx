import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, StyleSheet, useColorScheme } from 'react-native';

import { darkColors, lightColors, ThemeColors, ThemeMode } from '@/theme/tokens';

const STORAGE_KEY = '@camila-martins/theme-mode';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  fontsReady: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(mode: ThemeMode, system: ColorSchemeName): 'light' | 'dark' {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setStoredMode] = useState<ThemeMode>('dark');
  const [fontsReady] = useFonts({
    Brittany: require('../../assets/fonts/BrittanySignatureScript.ttf'),
  });

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark' || stored === 'system')) setStoredMode(stored);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setStoredMode(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const resolvedMode = resolveMode(mode, system);
  const value = useMemo<ThemeContextValue>(() => ({
    colors: resolvedMode === 'dark' ? darkColors : lightColors,
    mode,
    resolvedMode,
    fontsReady,
    setMode,
  }), [fontsReady, mode, resolvedMode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme deve ser usado dentro de ThemeProvider');
  return value;
}

export function useThemeStyles(factory: (colors: ThemeColors) => Record<string, unknown>): any {
  const { colors } = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(colors) as StyleSheet.NamedStyles<any>), [colors, factory]);
}
