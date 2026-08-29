import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { acceptCurrentLegalDocuments, getCurrentLegalAcceptance } from '@/services/legal-service';

interface LegalContextValue {
  accepted: boolean;
  loading: boolean;
  accepting: boolean;
  error: string | null;
  accept: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const LegalContext = createContext<LegalContextValue | null>(null);

export function LegalProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading, role, user } = useAuth();
  const userId = user?.id ?? null;
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [acceptedForUser, setAcceptedForUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || role === 'admin') {
      setVerifiedUserId(userId);
      setAcceptedForUser(role === 'admin');
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await getCurrentLegalAcceptance(userId);
    setVerifiedUserId(userId);
    setAcceptedForUser(result.accepted);
    setError(result.error);
    setLoading(false);
  }, [role, userId]);

  useEffect(() => {
    if (authLoading) return;
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [authLoading, refresh]);

  const accept = useCallback(async () => {
    if (!userId || (role !== 'client' && role !== 'collaborator')) return false;
    setAccepting(true);
    setError(null);
    const nextError = await acceptCurrentLegalDocuments(Platform.OS);
    if (nextError) {
      setError(nextError);
      setAccepting(false);
      return false;
    }
    setVerifiedUserId(userId);
    setAcceptedForUser(true);
    setAccepting(false);
    return true;
  }, [role, userId]);

  const accepted = role === 'admin' || Boolean(userId && verifiedUserId === userId && acceptedForUser);
  const value = useMemo<LegalContextValue>(
    () => ({ accepted, loading: authLoading || loading, accepting, error, accept, refresh }),
    [accept, accepted, accepting, authLoading, error, loading, refresh],
  );

  return <LegalContext.Provider value={value}>{children}</LegalContext.Provider>;
}

export function useLegal() {
  const value = useContext(LegalContext);
  if (!value) throw new Error('useLegal deve ser usado dentro de LegalProvider');
  return value;
}
