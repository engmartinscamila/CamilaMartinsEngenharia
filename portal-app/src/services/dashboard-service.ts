import { readAllRows } from '@/lib/paginated-query';
import { supabase } from '@/lib/supabase';

/** Data prevista de término de cada projeto (projetos.data_fim), somente leitura. */
export async function listProjectFinishDates(): Promise<{ data: Map<string, string | null>; error: string | null }> {
  const result = await readAllRows(supabase.from('projetos').select('id,data_fim').order('id'));
  if (result.error) return { data: new Map(), error: 'Não foi possível consultar os prazos das obras.' };
  return { data: new Map((result.data ?? []).map((row: { id: string; data_fim: string | null }) => [String(row.id), row.data_fim ? String(row.data_fim).slice(0, 10) : null])), error: null };
}
