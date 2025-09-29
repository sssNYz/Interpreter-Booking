import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export type StoredInviteMeta = {
  uid: string
  dtstart: string
  dtend: string
  sequence: number
  organizerLine: string
  // Optional: persist original ICS content for troubleshooting/auditing
  ics?: string
}

const STORE_DIR = path.resolve(process.cwd(), 'data')
const STORE_PATH = path.join(STORE_DIR, 'calendar-store.json')

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({}), 'utf8')
}

export function readStore(): Record<string, StoredInviteMeta> {
  ensureStore()
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function writeStore(data: Record<string, StoredInviteMeta>): void {
  ensureStore()
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

function hashUid(uid: string): string {
  return crypto.createHash('sha256').update(uid).digest('hex')
}

export function saveInviteMeta(meta: StoredInviteMeta): void {
  if (!meta.uid) {
    console.error('[SAVE_META] Cannot save meta without UID:', meta)
    return
  }

  const store = readStore()
  const key = hashUid(meta.uid)
  store[key] = meta

  try {
    writeStore(store)
    console.log(`[SAVE_META] Successfully saved meta for UID (hashed key): ${meta.uid}`, {
      dtstart: meta.dtstart,
      dtend: meta.dtend,
      sequence: meta.sequence,
      hasOrganizerLine: !!meta.organizerLine
    })
  } catch (error) {
    console.error('[SAVE_META] Failed to write store:', error)
    throw error
  }
}

export function getInviteMeta(uid: string): StoredInviteMeta | undefined {
  const store = readStore()
  const key = hashUid(uid)
  const meta = store[key]

  if (meta) {
    console.log(`[GET_META] Found meta for UID: ${uid}`, {
      dtstart: meta.dtstart,
      dtend: meta.dtend,
      sequence: meta.sequence,
      hasOrganizerLine: !!meta.organizerLine
    })
  } else {
    console.warn(`[GET_META] No meta found for UID: ${uid}. Available hashed keys:`, Object.keys(store))
  }

  return meta
}

export function extractMetaFromICS(icsContent: string): StoredInviteMeta | null {
  // Ensure CRLF for consistent regex across lines
  const ics = icsContent.replace(/\r?\n/g, '\r\n')

  // Handle line folding (RFC5545): continuation lines start with space or tab
  const unfoldedIcs = ics.replace(/\r\n[\s\t]+/g, '')

  const get = (key: string) => {
    const m = unfoldedIcs.match(new RegExp(`^${key}:(.*)$`, 'm'))
    return m ? m[1].trim() : null
  }
  const getLine = (key: string) => {
    const m = unfoldedIcs.match(new RegExp(`^${key}[^\r\n]*$`, 'm'))
    return m ? m[0].trim() : null
  }

  const uid = get('UID')
  const dtstart = get('DTSTART')
  const dtend = get('DTEND')
  const seqStr = get('SEQUENCE')
  const organizerLine = getLine('ORGANIZER')

  // Relaxed validation - only require essential fields for cancellation
  if (!uid || !dtstart || !dtend) {
    console.warn('[EXTRACT_META] Missing essential fields:', { uid, dtstart, dtend, organizerLine })
    return null
  }

  const sequence = seqStr ? parseInt(seqStr, 10) : 0

  return {
    uid,
    dtstart,
    dtend,
    sequence,
    organizerLine: organizerLine || '' // Allow empty organizer line, will be reconstructed if needed
  }
}

export function saveInviteIcs(uid: string, icsContent: string): void {
  if (!uid) return
  const store = readStore()
  const key = hashUid(uid)
  const existing = store[key]
  if (existing) {
    existing.ics = icsContent
    store[key] = existing
    writeStore(store)
  } else {
    // If meta wasn't saved yet, save minimal record with ICS
    store[key] = { uid, dtstart: '', dtend: '', sequence: 0, organizerLine: '', ics: icsContent }
    writeStore(store)
  }
}

export function deleteInviteMeta(uid: string): boolean {
  if (!uid) return false
  const store = readStore()
  const key = hashUid(uid)
  if (store[key]) {
    delete store[key]
    writeStore(store)
    console.log(`[DELETE_META] Removed stored invite for UID: ${uid}`)
    return true
  }
  console.warn(`[DELETE_META] No stored invite found for UID: ${uid}`)
  return false
}


