import { useGlobalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useSync } from '@/providers/sync-provider';
import { listProjectContexts } from '@/services/portal-service';
import type { ProjectContext as ProjectContextType } from '@/types/domain';

const LAST_PROJECT_KEY = '@cme:last-project-id';

interface ProjectContextValue {
  projects: ProjectContextType[];
  selectedProject: ProjectContextType | null;
  loading: boolean;
  error: string | null;
  selectProject: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { client, role } = useAuth();
  const { revision } = useSync();
  const { projectId: requestedProjectId } = useGlobalSearchParams<{ projectId?: string }>();
  const [projects, setProjects] = useState<ProjectContextType[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listProjectContexts(role === 'client' ? client?.id : undefined);
    setProjects(result.data);
    setError(result.error);

    const remembered = await AsyncStorage.getItem(LAST_PROJECT_KEY).catch(() => null);
    setSelectedProject((current) => result.data.find((item) => item.id === current?.id) ?? result.data.find((item) => item.id === remembered) ?? result.data[0] ?? null);
    setLoading(false);
  }, [client?.id, role]);

  useEffect(() => {
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [refresh, revision]);

  const selectProject = useCallback(
    async (projectId: string) => {
      const project = projects.find((item) => item.id === projectId) ?? null;
      if (!project) return;
      setSelectedProject(project);
      setError(null);
      if (requestedProjectId && requestedProjectId !== project.id) router.setParams({ projectId: project.id });
      if (project) await AsyncStorage.setItem(LAST_PROJECT_KEY, project.id).catch(() => undefined);
    },
    [projects, requestedProjectId, router],
  );

  useEffect(() => {
    if (!requestedProjectId || loading) return;
    const timer = setTimeout(() => {
      if (!projects.some((item) => item.id === requestedProjectId)) {
        setError('O projeto deste aviso não está disponível para sua conta.');
        return;
      }
      void selectProject(requestedProjectId);
    }, 0);
    return () => clearTimeout(timer);
  }, [requestedProjectId, loading, projects, selectProject]);

  const value = useMemo(
    () => ({ projects, selectedProject, loading, error, selectProject, refresh }),
    [error, loading, projects, refresh, selectProject, selectedProject],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProject deve ser usado dentro de ProjectProvider');
  return value;
}
