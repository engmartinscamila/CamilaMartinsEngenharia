import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSync } from '@/providers/sync-provider';

// Refresh visible screens after a site/app change and when returning to them.
export function useLiveRefresh(load: () => Promise<void>, delay = 0) {
  const { revision } = useSync();
  useFocusEffect(useCallback(() => {
    void revision;
    const timer = setTimeout(() => { void load(); }, delay);
    return () => clearTimeout(timer);
  }, [load, revision, delay]));
}
