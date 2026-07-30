import { supabase } from './supabase'

/**
 * Fire-and-forget Telegram bildirishnoma.
 * Xato bo'lsa ham asosiy CRM oqimini buzmaydi.
 */
export function notifyTelegram(type, data) {
  try {
    supabase.functions
      .invoke('send-telegram-notification', { body: { type, data } })
      .catch((err) => console.warn('Telegram notify:', err?.message || err))
  } catch (err) {
    console.warn('Telegram notify:', err?.message || err)
  }
}
