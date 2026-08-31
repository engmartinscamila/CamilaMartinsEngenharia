import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence, ReactNativeAsyncStorage } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyD0jrO5hiWQIexzpcDHk1EsFq0t_y8XN5Q',
  authDomain: 'cm-engenharia-62f61.firebaseapp.com',
  projectId: 'cm-engenharia-62f61',
  storageBucket: 'cm-engenharia-62f61.firebasestorage.app',
  messagingSenderId: '75516356862',
  appId: '1:75516356862:web:6e35b2c4fb01ce7a0d5daf',
};

type FirebaseAuthWithReactNativePersistence = typeof FirebaseAuth & {
  getReactNativePersistence: (storage: ReactNativeAsyncStorage) => Persistence;
};

const existingApp = getApps()[0];
export const firebaseApp = existingApp ?? initializeApp(firebaseConfig);

function initializeFirebaseAuth(): Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(firebaseApp);

  try {
    const reactNativeAuth = FirebaseAuth as FirebaseAuthWithReactNativePersistence;
    if (typeof reactNativeAuth.getReactNativePersistence !== 'function') {
      return FirebaseAuth.getAuth(firebaseApp);
    }

    return FirebaseAuth.initializeAuth(firebaseApp, {
      persistence: reactNativeAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return FirebaseAuth.getAuth(firebaseApp);
  }
}

export const auth = initializeFirebaseAuth();
export const db = getFirestore(firebaseApp);
