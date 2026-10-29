import {useAdminModule} from '@/providers/admin-module-context';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

export function useNotificationProject(projects: { id: string }[], select: (id: string) => void) {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const embedded=useAdminModule();
  const projectId=embedded?embedded.projectId:params.projectId;
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectId) { applied.current = undefined; return; }
    if (applied.current === projectId || !projects.some((project) => project.id === projectId)) return;
    const timer = setTimeout(() => { applied.current = projectId; select(projectId); }, 0);
    return () => clearTimeout(timer);
  }, [projectId, projects, select]);
}
