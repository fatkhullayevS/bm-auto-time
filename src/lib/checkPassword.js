import { supabase } from './supabase'

export async function checkDeletePassword(input) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'delete_password')
    .single()
  return data?.value === input
}

/** Kassir to'lov / rasxot kiritish paroli (yashirin input uchun) */
export async function checkViewPassword(input) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'view_password')
    .single()
  return data?.value === input
}
