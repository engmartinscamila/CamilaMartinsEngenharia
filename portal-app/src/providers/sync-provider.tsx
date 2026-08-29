import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const LAST_SYNC_KEY = '@cme:last-successful-sync';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'offline' | 'error';

interface SyncContextValue {
  lastSyncedAt: string | null;
  realtimeConnected: boolean;
  revision: number;
  status: SyncStatus;
  syncNow: () => Promise<boolean>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { refreshIdentity, session } = useAuth();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSynchronized = useCallback(async () => {
    const timestamp = new Date().toISOString();
    setLastSyncedAt(timestamp);
    setRevision((current) => current + 1);
    await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNC_KEY).then(setLastSyncedAt).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;

    const channel = supabase
      .channel(`portal-mirror-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (pendingRefresh.current) clearTimeout(pendingRefresh.current);
        pendingRefresh.current = setTimeout(() => {
          void markSynchronized();
          setStatus('success');
        }, 450);
      })
      .subscribe((nextStatus) => {
        const connected = nextStatus === 'SUBSCRIBED';
        setRealtimeConnected(connected);
        if (connected) {
          void markSynchronized();
          setStatus('success');
        }
      });

    return () => {
      if (pendingRefresh.current) clearTimeout(pendingRefresh.current);
      pendingRefresh.current = null;
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [markSynchronized, session?.user.id]);

  const syncNow = useCallback(async () => {
    if (!session) {
      setStatus('error');
      return false;
    }

    setStatus('syncing');
    try {
      const network = await Network.getNetworkStateAsync();
      if (!network.isConnected || network.isInternetReachable === false) {
        setStatus('offline');
        return false;
      }

      const verified = await supabase.auth.getUser();
      if (verified.error || !verified.data.user) throw verified.error ?? new Error('Sessão não validada.');
      await refreshIdentity();
      await markSynchronized();
      setStatus('success');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [markSynchronized, refreshIdentity, session]);

  const value = useMemo<SyncContextValue>(
    () => ({ lastSyncedAt, realtimeConnected, revision, status, syncNow }),
    [lastSyncedAt, realtimeConnected, revision, status, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync deve ser usado dentro de SyncProvider');
  return value;
}
