import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';

/**
 * Firebase is being introduced in parallel while the existing portal still
 * depends on Supabase for its current data, RLS policies and realtime feeds.
 * Bridge failures must never interrupt the working Supabase login during the
 * migration period.
 */
export async function signInFirebaseBridge(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return true;
  } catch {
    return false;
  }
}

export async function signOutFirebaseBridge() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // The legacy portal session remains authoritative during migration.
  }
}

export async function updateFirebasePasswordBridge(password: string) {
  try {
    if (!auth.currentUser) return false;
    await firebaseUpdatePassword(auth.currentUser, password);
    return true;
  } catch {
    return false;
  }
}
