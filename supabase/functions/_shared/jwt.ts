const encoder = new TextEncoder()

function getSecret() {
  const secret = Deno.env.get('AGENT_JWT_SECRET')
  if (!secret) {
    throw new Error('AGENT_JWT_SECRET environment variable is not set')
  }
  return secret
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof data === 'string') {
    bytes = encoder.encode(data)
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data)
  } else {
    bytes = data
  }
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4)
  const base = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export type AgentTokenPayload = {
  agent_id: string
  full_name: string
  typ: 'agent'
  iat: number
  exp: number
}

/** 7 kunlik JWT */
export async function signAgentToken(agentId: string, fullName: string, ttlSec = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: AgentTokenPayload = {
    agent_id: agentId,
    full_name: fullName,
    typ: 'agent',
    iat: now,
    exp: now + ttlSec,
  }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(payload))
  const data = `${h}.${p}`
  const key = await hmacKey(getSecret())
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return `${data}.${b64url(sig)}`
}

export async function verifyAgentToken(token: string): Promise<AgentTokenPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [h, p, s] = parts
  const key = await hmacKey(getSecret())
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(s),
    encoder.encode(`${h}.${p}`),
  )
  if (!ok) throw new Error('Invalid signature')
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as AgentTokenPayload
  if (payload.typ !== 'agent') throw new Error('Wrong token type')
  if (!payload.agent_id) throw new Error('Missing agent_id')
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired')
  return payload
}

export function extractAgentToken(req: Request): string | null {
  const custom = req.headers.get('x-agent-token')
  if (custom) return custom.trim()
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('token')
    if (q) return q
  } catch {
    /* ignore */
  }
  return null
}
