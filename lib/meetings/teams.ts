import { graphFetch, getOrganizerUpn } from '@/lib/msgraph/client'

type CreateMeetingParams = {
  start?: string | Date
  end?: string | Date
  subject?: string
  organizerUpn?: string
}

function asBool(v: string | undefined): boolean {
  if (!v) return false
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

function toGraphISO(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date)
  const input = typeof date === 'string' ? date : date.toISOString()
  const hasTZ = typeof date === 'string' && (input.includes('Z') || input.includes('+') || /-\d{2}:\d{2}$/.test(input))
  if (hasTZ) return new Date(input).toISOString()

  // Treat as Asia/Bangkok local and convert to UTC
  const year = d.getFullYear()
  const month = d.getMonth()
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const seconds = d.getSeconds()
  const utc = new Date(Date.UTC(year, month, day, hours - 7, minutes, seconds))
  return utc.toISOString()
}

function addMinutes(date: string | Date, mins: number): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  d.setMinutes(d.getMinutes() + mins)
  return d
}

/**
 * Create a Teams online meeting and return the join URL.
 * If ENABLE_MS_TEAMS is not true, returns null (no-op).
 */
export async function createTeamsMeeting(params: CreateMeetingParams): Promise<string | null> {
  if (!asBool(process.env.ENABLE_MS_TEAMS)) return null

  const organizer = params.organizerUpn || getOrganizerUpn()
  const defaultDuration = parseInt(process.env.MS_TEAMS_DEFAULT_DURATION_MIN || '60', 10)

  const start = params.start
  const end = params.end || (start ? addMinutes(start, defaultDuration) : undefined)

  const body: Record<string, unknown> = {
    subject: params.subject || 'Meeting',
  }

  if (start) body['startDateTime'] = toGraphISO(start)
  if (end) body['endDateTime'] = toGraphISO(end)

  try {
    const resp = await graphFetch<any>(`/users/${encodeURIComponent(organizer)}/onlineMeetings`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    const url: string | undefined = resp?.joinWebUrl || resp?.joinUrl || resp?.onlineMeeting?.joinUrl
    return url || null
  } catch (err) {
    console.error('[TEAMS] Failed to create online meeting:', err)
    return null
  }
}

