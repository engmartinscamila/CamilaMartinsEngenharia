import { Platform } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  navy950: string;
  navy900: string;
  navy800: string;
  navy700: string;
  gold600: string;
  gold500: string;
  gold300: string;
  ink: string;
  slate: string;
  muted: string;
  line: string;
  surface: string;
  surfaceRaised: string;
  background: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
}

const siteCore = {
  navy950: '#000711',
  navy900: '#010914',
  navy800: '#030D1A',
  navy700: '#07111F',
  gold600: '#B89A63',
  gold500: '#B89A63',
  gold300: '#D0B47A',
} as const;

export const darkColors: ThemeColors = {
  ...siteCore,
  ink: '#D8DADD',
  slate: '#C1C5CB',
  muted: '#AEB4BD',
  line: 'rgba(184, 154, 99, 0.34)',
  surface: '#030D1A',
  surfaceRaised: '#07111F',
  background: '#010914',
  success: '#8FC9A9',
  successSoft: 'rgba(62, 125, 88, 0.20)',
  warning: '#D0B47A',
  warningSoft: 'rgba(184, 154, 99, 0.14)',
  danger: '#F0A2A2',
  dangerSoft: 'rgba(164, 64, 64, 0.20)',
  info: '#91BEDD',
  infoSoft: 'rgba(52, 106, 145, 0.22)',
  overlay: 'rgba(0, 7, 17, 0.86)',
};

export const lightColors: ThemeColors = {
  ...siteCore,
  ink: '#102131',
  slate: '#526170',
  muted: '#6F7C88',
  line: 'rgba(16, 33, 49, 0.18)',
  surface: '#FFFFFF',
  surfaceRaised: '#F8F4ED',
  background: '#F3F1ED',
  success: '#2C7655',
  successSoft: '#E8F4ED',
  warning: '#8A5C1A',
  warningSoft: '#FFF4DD',
  danger: '#A44040',
  dangerSoft: '#FBEAEA',
  info: '#346A91',
  infoSoft: '#EAF3F9',
  overlay: 'rgba(0, 7, 17, 0.72)',
};

// Mantido apenas para módulos legados durante a transição. Componentes novos
// devem obter as cores pelo ThemeProvider.
export const colors = darkColors;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 2,
  md: 3,
  lg: 4,
  pill: 999,
} as const;

export const typography = {
  family: Platform.select({
    web: '"Century Gothic", "Avenir Next", Arial, sans-serif',
    ios: 'Century Gothic',
    android: 'Century Gothic',
    default: 'Century Gothic',
  }),
  signature: Platform.select({
    web: '"Brittany", "Brittany Signature Script", "Segoe Script", cursive',
    ios: 'Brittany',
    android: 'Brittany',
    default: 'Brittany',
  }),
  size: {
    caption: 12,
    body: 15,
    bodyLarge: 17,
    title: 24,
    display: 32,
  },
} as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: siteCore.navy950,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  android: { elevation: 2 },
  default: { boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)' },
});

export const layout = {
  maxContentWidth: 1120,
  maxFormWidth: 460,
  minTouchTarget: 44,
} as const;
