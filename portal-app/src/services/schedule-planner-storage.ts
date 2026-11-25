/* Rascunhos do planejador de cronograma guardados neste aparelho/navegador.
 * Não grava no Supabase nem vincula a contrato, cliente ou projeto. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlannerProject } from '@/lib/schedule-planner';

const KEY = 'cme.schedulePlanner.v1';

export async function loadPlannerProjects(): Promise<PlannerProject[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.activities)) : [];
  } catch {
    return [];
  }
}

export async function savePlannerProjects(projects: PlannerProject[]): Promise<string | null> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(projects));
    return null;
  } catch {
    return 'Não foi possível salvar o rascunho neste navegador.';
  }
}
