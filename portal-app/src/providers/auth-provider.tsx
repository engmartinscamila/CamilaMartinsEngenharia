import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import {
  resolveIdentity,
  sendAccessLink,
  signInWithPassword,
  updatePassword,
} from '@/services/auth-service';
import type { AppRole, ClientProfile } from '@/types/domain';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole;
  client: ClientProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestAccessLink: (email: string) => Promise<string | null>;
  changePassword: (password: string) => Promise<string | null>;
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function applyAuthUrl(url: string) {
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>('unassigned');
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(env.isSupabaseConfigured);

  const setIdentity = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setSession(null);
      setRole('unassigned');
      setClient(null);
      return;
    }

    setSession(nextSession);
    const identity = await resolveIdentity(nextSession.user);
    setRole(identity.role);
    setClient(identity.client);
  }, []);

  useEffect(() => {
    let active = true;

    if (!env.isSupabaseConfigured) {
      return () => {
        active = false;
      };
    }

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (active) await setIdentity(data.session);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setRole('unassigned');
        setClient(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setLoading(true);
      setTimeout(() => {
        if (!active) return;
        setIdentity(nextSession)
          .catch(() => {
            setRole('unassigned');
            setClient(null);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [setIdentity]);

  useEffect(() => {
    if (Platform.OS === 'web' || !env.isSupabaseConfigured) return;

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    Linking.getInitialURL().then((url) => {
      if (url) void applyAuthUrl(url).catch(() => undefined);
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void applyAuthUrl(url).catch(() => undefined);
    });

    return () => {
      appStateSubscription.remove();
      linkingSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const refreshIdentity = useCallback(async () => {
    if (session) await setIdentity(session);
  }, [session, setIdentity]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      client,
      loading,
      configured: env.isSupabaseConfigured,
      signIn: signInWithPassword,
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setRole('unassigned');
        setClient(null);
      },
      requestAccessLink: (email) =>
        sendAccessLink(email, Linking.createURL('/reset-password')),
      changePassword: updatePassword,
      refreshIdentity,
    }),
    [client, loading, refreshIdentity, role, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}
