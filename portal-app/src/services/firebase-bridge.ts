import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';

/**
 * Transitional Firebase bridge.
 *
 * Supabase remains authoritative for the portal while the shared backend is
 * migrated. Firebase is established in parallel only for accounts that already
 * exist there and have an active /users/{uid} document. A Firebase failure must
 * never interrupt the working Supabase portal during this migration stage.
 */
export async function signInFirebaseBridge(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    );

    const identity = await getDoc(doc(db, 'users', credential.user.uid));
    if (!identity.exists() || identity.data().active !== true) {
      await firebaseSignOut(auth);
      return false;
    }

    return true;
  } catch {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Keep migration failures isolated from the existing portal session.
    }
    return false;
  }
}

export async function signOutFirebaseBridge() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // The Supabase portal session remains authoritative during migration.
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
