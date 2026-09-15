import { supabase } from '../lib/supabase'

export type ProjectSummary = {
  id: string
  name: string
}

export async function listAccessibleProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: true })

  return {
    projects: (data ?? []) as ProjectSummary[],
    error,
  }
}
