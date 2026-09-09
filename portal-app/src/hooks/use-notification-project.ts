import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

export function useNotificationProject(projects: { id: string }[], select: (id: string) => void) {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectId) { applied.current = undefined; return; }
    if (applied.current === projectId || !projects.some((project) => project.id === projectId)) return;
    const timer = setTimeout(() => { applied.current = projectId; select(projectId); }, 0);
    return () => clearTimeout(timer);
  }, [projectId, projects, select]);
}
