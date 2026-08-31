import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { env } from './env';

const fallbackUrl = 'https://configuration-required.supabase.co';
const fallbackKey = 'configuration-required-public-key';
const appVersion = Constants.expoConfig?.version ?? 'unknown';

const secureSessionStorage = {
  getItem: async (key: string) => {
    if (!(await SecureStore.isAvailableAsync())) throw new Error('Armazenamento seguro indisponível neste aparelho.');
    const protectedValue = await SecureStore.getItemAsync(key);
    if (protectedValue !== null) return protectedValue;

    // Migração única das sessões de versões anteriores, que usavam AsyncStorage.
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue !== null) {
      await SecureStore.setItemAsync(key, legacyValue, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      await AsyncStorage.removeItem(key);
    }
    return legacyValue;
  },
  setItem: async (key: string, value: string) => {
    if (!(await SecureStore.isAvailableAsync())) throw new Error('Armazenamento seguro indisponível neste aparelho.');
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await AsyncStorage.removeItem(key);
  },
  removeItem: async (key: string) => {
    if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  env.isSupabaseConfigured ? env.supabaseUrl : fallbackUrl,
  env.isSupabaseConfigured ? env.supabaseAnonKey : fallbackKey,
  {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: secureSessionStorage }),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      lock: processLock,
      flowType: 'pkce',
    },
    global: {
      headers: { 'X-Client-Info': `camila-martins-engenharia-app/${appVersion}` },
    },
  },
);
