import { supabase } from './supabase'

export async function checkDeletePassword(input) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'delete_password')
    .single()
  return data?.value === input
}
