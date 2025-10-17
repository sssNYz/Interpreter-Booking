/**
 * Minimal Microsoft Graph client using OAuth2 Client Credentials.
 * No external deps: uses global fetch (Node 18+).
 */

type TokenResponse = {
  token_type: string
  expires_in: number
  ext_expires_in?: number
  access_token: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

function getEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function fetchToken(): Promise<string> {
  const tenantId = getEnv('MS_GRAPH_TENANT_ID')
  const clientId = getEnv('MS_GRAPH_CLIENT_ID')
  const clientSecret = getEnv('MS_GRAPH_CLIENT_SECRET')

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph token error: ${res.status} ${res.statusText} ${text}`)
  }

  const data = (await res.json()) as TokenResponse
  const expiresAt = Date.now() + (data.expires_in ?? 3000) * 1000
  cachedToken = { token: data.access_token, expiresAt }
  return data.access_token
}

export async function graphFetch<T = unknown>(path: string, init?: RequestInit & { asJson?: boolean }): Promise<T> {
  const token = await fetchToken()
  const url = path.startsWith('http') ? path : `https://graph.microsoft.com/v1.0${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const base = new Headers(headers);
if (init?.headers) new Headers(init.headers).forEach((v, k) => base.set(k, v));
const res = await fetch(url, { ...init, headers: base });
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph fetch error ${res.status} ${res.statusText} ${text}`)
  }
  // If caller wants raw text or empty body, handle gracefully
  if (init?.asJson === false) {
    return (await res.text()) as T
  }
  if (res.status === 204) {

    return undefined as T
  }
  return (await res.json()) as T
}

export function getOrganizerUpn(): string {
  // Prefer explicit organizer env; fallback to SMTP_FROM_EMAIL as requested
  const upn = process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL
  if (!upn) throw new Error('Missing organizer UPN: set MS_GRAPH_ORGANIZER_UPN or SMTP_FROM_EMAIL')
  return upn
}

