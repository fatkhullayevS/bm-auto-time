import { userClientFromAuthHeader, serviceClient } from './supabase.ts'

const ALLOWED_ROLES = new Set(['boss', 'kassir', 'cashier'])

/** Caller Supabase Auth session + profiles.role = boss|kassir */
export async function requireStaff(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { error: 'Authorization kerak', status: 401 as const }
  }

  const userSb = userClientFromAuthHeader(authHeader)
  const { data: userData, error: userErr } = await userSb.auth.getUser()
  if (userErr || !userData?.user) {
    return { error: 'Sessiya yaroqsiz', status: 401 as const }
  }

  const admin = serviceClient()
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userData.user.id)
    .single()

  if (profileErr || !profile) {
    return { error: 'Profil topilmadi', status: 403 as const }
  }

  if (!ALLOWED_ROLES.has(profile.role)) {
    return { error: "Faqat boss yoki kassir bu amalni qila oladi", status: 403 as const }
  }

  return { user: userData.user, profile }
}
