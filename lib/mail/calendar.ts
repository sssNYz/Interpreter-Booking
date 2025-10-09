/**
 * Calendar invite utilities for generating .ics files
 * Supports RFC 5545 iCalendar specification
 */

export interface CalendarEvent {
  uid?: string
  summary?: string
  description?: string
  location?: string
  start?: string // ISO string format
  end?: string // ISO string format
  timezone?: string
  organizer?: {
    name?: string
    email?: string
  }
  attendees?: Array<{
    name?: string
    email?: string
    role?: 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT'
    status?: 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'
  }>
  sequence?: number
  method?: 'REQUEST' | 'CANCEL'
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/**
 * Generate a unique UID for calendar events
 * Phase 1: Fix UID format to contain exactly one @ character
 */
export function generateEventUID(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)

  // Extract domain from SMTP_FROM_EMAIL or FROM_EMAIL
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
  const domain = fromEmail.split('@')[1] || 'dit.daikin.co.jp'

  return `${timestamp}-${random}@${domain}`
}

/**
 * Format date for iCalendar (RFC5545 basic format)
 * CRITICAL: Database stores times WITHOUT timezone info (naive datetime)
 * We treat them as Bangkok time and convert to UTC for the .ics file
 */
function formatICalDate(dateString: string, timezone?: string): string {
  // Parse the date string
  // If the database stores "2025-01-08 08:00:00", JavaScript will interpret it in local server time
  // We need to treat it as Bangkok time (UTC+7) and convert to UTC

  const date = new Date(dateString)

  // Check if the date string already has timezone info (ends with Z or has +/-)
  const hasTimezone = dateString.includes('Z') || dateString.includes('+') || dateString.match(/-\d{2}:\d{2}$/)

  if (hasTimezone) {
    // If it already has timezone, use UTC directly
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  } else {
    // If no timezone info, treat as Bangkok time (UTC+7) and convert to UTC
    // Get the local components (which represent Bangkok time)
    const bangkokYear = date.getFullYear()
    const bangkokMonth = date.getMonth()
    const bangkokDay = date.getDate()
    const bangkokHours = date.getHours()
    const bangkokMinutes = date.getMinutes()
    const bangkokSeconds = date.getSeconds()

    // Create UTC date by subtracting 7 hours
    const utcDate = new Date(Date.UTC(
      bangkokYear,
      bangkokMonth,
      bangkokDay,
      bangkokHours - 7, // Subtract 7 hours to convert Bangkok to UTC
      bangkokMinutes,
      bangkokSeconds
    ))

    // Format as RFC5545 basic UTC format
    const year = utcDate.getUTCFullYear()
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(utcDate.getUTCDate()).padStart(2, '0')
    const hours = String(utcDate.getUTCHours()).padStart(2, '0')
    const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0')
    const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0')

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  }
}

/**
 * Ensure consistent date format for calendar events
 * CRITICAL: For cancellations, this preserves the exact original format
 * Note: This function is currently unused but kept for future reference
 */
// function ensureConsistentDateFormat(dateString: string, isCancellation: boolean = false): string {
//   if (isCancellation) {
//     // For cancellations, return the date as-is to preserve original format
//     return dateString
//   } else {
//     // For new events, ensure RFC5545 basic UTC format
//     return formatICalDate(dateString)
//   }
// }

/**
 * Escape text for iCalendar format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Format attendee for iCalendar
 * Enhanced for Outlook compatibility
 */
function formatAttendee(attendee: NonNullable<CalendarEvent['attendees']>[0]): string {
  const paramParts: string[] = []

  // CN (Common Name) - required for Outlook
  if (attendee.name) {
    paramParts.push(`CN=${escapeICalText(attendee.name)}`)
  } else {
    // Generate name from email if not provided
    const name = attendee.email?.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown'
    paramParts.push(`CN=${escapeICalText(name)}`)
  }

  // ROLE - required for Outlook
  if (attendee.role) {
    paramParts.push(`ROLE=${attendee.role}`)
  }

  // RSVP - set TRUE for both required and optional participants so they can respond
  paramParts.push('RSVP=TRUE')

  // PARTSTAT - for cancellations, keep as NEEDS-ACTION
  if (attendee.status) {
    paramParts.push(`PARTSTAT=${attendee.status}`)
  }

  // Email address value must follow a colon after parameters
  const mailtoValue = `mailto:${attendee.email}`

  return `ATTENDEE;${paramParts.join(';')}:${mailtoValue}`
}

/**
 * Apply line folding for lines > 75 octets (RFC5545)
 * CRITICAL: Must not break words - fold at safe boundaries only
 * CRITICAL: Never fold inside tokens like "mailto:", "CN=", etc.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line

  const folded: string[] = []
  let remaining = line

  while (remaining.length > 75) {
    // Find the best break point (avoid breaking words and tokens)
    let breakPoint = 75

    // Define safe delimiters where we can break
    // Include ':' so we can break right after property-value separators like "SUMMARY:" or 
    // after parameter-value separator before "mailto:..."
    const safeDelimiters = [' ', ';', ',', ':']
    const unsafeTokens = ['mailto:', 'CN=', 'ROLE=', 'RSVP=', 'PARTSTAT=', 'Cancelled']

    // Look for safe break points, prioritizing later positions
    for (let i = 74; i >= 50; i--) {
      const char = remaining[i]

      if (safeDelimiters.includes(char)) {
        // Check if we're inside an unsafe token
        let isInsideUnsafeToken = false
        for (const token of unsafeTokens) {
          const tokenStart = remaining.lastIndexOf(token, i)
          if (tokenStart >= 0) {
            const tokenEnd = tokenStart + token.length - 1
            // If cursor is strictly within token, it's unsafe
            if (i >= tokenStart && i < tokenEnd) {
              isInsideUnsafeToken = true
              break
            }
            // Special-case: allow breaking exactly AFTER the end of the token
            // e.g., allow break at the ':' in "mailto:"
            if (i === tokenEnd && char === ':') {
              // This is safe; do not mark as inside unsafe token
            }
          }
        }

        if (!isInsideUnsafeToken) {
          breakPoint = i + 1 // Break after the delimiter
          break
        }
      }
    }

    // If no safe break found, we have to break at 75 (RFC5545 hard limit)
    if (breakPoint >= 75) {
      breakPoint = 75
    }

    folded.push(remaining.substring(0, breakPoint))
    remaining = ' ' + remaining.substring(breakPoint) // SPACE + continuation line
  }

  if (remaining.length > 0) {
    folded.push(remaining)
  }

  // CRITICAL: Use CRLF line endings as required by RFC 5545
  return folded.join('\r\n')
}

/**
 * Generate iCalendar content for an event
 * Enhanced for Outlook compatibility with proper CANCEL handling and CRLF line endings
 */
export function generateICalContent(event: CalendarEvent): string {
  const lines: string[] = []

  // Header - RFC 5545 compliant format
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//DEDE_SYSTEM//Email Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push(`METHOD:${event.method || 'REQUEST'}`)

  // Event
  lines.push('BEGIN:VEVENT')

  // UID - REQUIRED field, must be exact same as original for cancellations
  const uid = event.uid || generateEventUID()
  lines.push(`UID:${uid}`)

  // SEQUENCE - REQUIRED for updates/cancellations (original: 0, cancel: 1)
  const sequence = event.sequence !== undefined ? event.sequence : 0
  lines.push(`SEQUENCE:${sequence}`)

  // DTSTAMP - REQUIRED field, current timestamp in UTC
  const now = new Date()
  lines.push(`DTSTAMP:${formatICalDate(now.toISOString())}`)

  // DTSTART/DTEND - REQUIRED fields, must match original invite exactly for cancellations
  if (event.start && event.end) {
    // CRITICAL: For cancellations, use EXACT same format as original event
    // Do NOT convert timezone - preserve original format to ensure exact match
    if (event.method === 'CANCEL') {
      // For cancellations, use the exact same format as the original
      lines.push(`DTSTART:${event.start}`)
      lines.push(`DTEND:${event.end}`)
    } else {
      // For new events, convert Bangkok time to UTC format (YYYYMMDDTHHMMSSZ)
      // This ensures maximum compatibility with all calendar clients
      const startUTC = isBasicDateTime(event.start) ? event.start : formatICalDate(event.start)
      const endUTC = isBasicDateTime(event.end) ? event.end : formatICalDate(event.end)
      lines.push(`DTSTART:${startUTC}`)
      lines.push(`DTEND:${endUTC}`)
    }
  }

  // SUMMARY - REQUIRED field; keep identical for CANCEL to maximize client matching
  const summary = event.summary || 'Meeting'
  const displaySummary = summary
  lines.push(foldLine(`SUMMARY:${escapeICalText(displaySummary)}`))

  // DESCRIPTION - Optional but helpful
  if (event.description) {
    const description = event.method === 'CANCEL'
      ? `This meeting has been cancelled.\n\n${event.description}`
      : event.description
    lines.push(foldLine(`DESCRIPTION:${escapeICalText(description)}`))
  }

  // LOCATION - Optional
  if (event.location) {
    lines.push(foldLine(`LOCATION:${escapeICalText(event.location)}`))
  }

  // ORGANIZER - REQUIRED field, must match SMTP From address for proper recognition
  // Format: ORGANIZER;CN=Name:mailto:email@domain.com
  // CRITICAL: For cancellations, organizer MUST be exactly the same as original event
  if (event.organizer?.email) {
    const organizerName = event.organizer.name || 'DEDE_SYSTEM'
    lines.push(foldLine(`ORGANIZER;CN=${escapeICalText(organizerName)}:mailto:${event.organizer.email}`))
  } else {
    // CRITICAL: This should never happen for cancellations due to validation in createCancelledCalendarEvent
    // But provide fallback for new events
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
    const fromName = process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'
    lines.push(foldLine(`ORGANIZER;CN=${escapeICalText(fromName)}:mailto:${fromEmail}`))
  }

  // ATTENDEE - At least one REQUIRED for proper calendar recognition
  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach(attendee => {
      if (attendee.email) {
        lines.push(foldLine(formatAttendee(attendee)))
      }
    })
  } else {
    // If no attendees specified, add organizer as attendee for compatibility
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
    const fromName = process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'
    lines.push(foldLine(`ATTENDEE;CN=${escapeICalText(fromName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${fromEmail}`))
  }

  // STATUS - Important for cancellations
  // CRITICAL: For CANCEL events, status should be CANCELLED
  const status = event.method === 'CANCEL' ? 'CANCELLED' : (event.status || 'CONFIRMED')
  lines.push(`STATUS:${status}`)

  // NOTE: RECURRENCE-ID is only for recurring events, not single events
  // For single events, the UID + SEQUENCE combination is sufficient for cancellation

  // End event
  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  // CRITICAL: Use CRLF (\r\n) line endings as required by RFC 5545
  // This is essential for proper calendar client recognition
  return lines.join('\r\n')
}

/**
 * Generate calendar invite for email attachment
 */
export function generateCalendarInvite(event: CalendarEvent): {
  filename: string
  content: string
  contentType: string
} {
  // CRITICAL: Ensure organizer matches SMTP From address for proper Outlook recognition
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
  const fromName = process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'

  // For cancellations, preserve original organizer exactly
  // For new events, ensure organizer matches SMTP From
  if (event.method !== 'CANCEL' && (!event.organizer || event.organizer.email !== fromEmail)) {
    event.organizer = {
      name: fromName,
      email: fromEmail
    }
  }

  const icalContent = generateICalContent(event)

  return {
    filename: `${(event.summary || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`,
    content: icalContent,
    contentType: `text/calendar; method=${event.method || 'REQUEST'}; charset=UTF-8`
  }
}

/**
 * Create a calendar event from basic parameters
 */
export function createCalendarEvent(params: {
  uid?: string
  summary?: string
  description?: string
  location?: string
  start?: string | Date
  end?: string | Date
  timezone?: string
  organizerName?: string
  organizerEmail?: string
  attendeeEmails?: string[]
  attendeeNames?: string[]
  ccAttendeeEmails?: string[]
  ccAttendeeNames?: string[]
  method?: 'REQUEST' | 'CANCEL'
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
  sequence?: number
}): CalendarEvent {
  const toAttendees = params.attendeeEmails?.map((email, index) => ({
    name: params.attendeeNames?.[index],
    email,
    role: 'REQ-PARTICIPANT' as const,
    status: 'NEEDS-ACTION' as const
  })) || []

  const ccAttendees = params.ccAttendeeEmails?.map((email, index) => ({
    name: params.ccAttendeeNames?.[index],
    email,
    role: 'OPT-PARTICIPANT' as const,
    status: 'NEEDS-ACTION' as const
  })) || []

  const attendees = [...toAttendees, ...ccAttendees]

  // Format dates for ICS using Asia/Bangkok timezone (local time, no conversion)
  const formatDateForICS = (date: string | Date): string => {
    if (date instanceof Date) {
      // Use the Date object directly - it already has the correct local time
      return formatICalDate(date.toISOString())
    }
    // If it's already a string, validate it's a proper date first
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format: ${date}`)
    }
    // CRITICAL: Don't convert to ISO string as it converts to UTC
    // Instead, format the date components directly
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const hours = String(dateObj.getHours()).padStart(2, '0')
    const minutes = String(dateObj.getMinutes()).padStart(2, '0')
    const seconds = String(dateObj.getSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}`
  }

  return {
    uid: params.uid || generateEventUID(),
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: formatDateForICS(params.start!),
    end: formatDateForICS(params.end!),
    timezone: params.timezone || 'Asia/Bangkok',
    organizer: params.organizerName && params.organizerEmail ? {
      name: params.organizerName,
      email: params.organizerEmail
    } : undefined,
    attendees: attendees.length > 0 ? attendees : undefined,
    method: params.method || 'REQUEST',
    status: params.status || 'CONFIRMED',
    sequence: params.sequence || 0
  }
}

/**
 * Create an updated calendar event (for updates)
 */
export function createUpdatedCalendarEvent(
  originalEvent: CalendarEvent,
  updates: Partial<Omit<CalendarEvent, 'uid' | 'sequence' | 'method'>>
): CalendarEvent {
  return {
    ...originalEvent,
    ...updates,
    sequence: (originalEvent.sequence || 0) + 1,
    method: 'REQUEST'
  }
}

/**
 * Create a cancelled calendar event
 * Enhanced for Outlook compatibility with proper sequence handling
 * CRITICAL: Preserves exact UID, DTSTART, DTEND, and ORGANIZER from original event
 */
export function createCancelledCalendarEvent(originalEvent: CalendarEvent): CalendarEvent {
  // CRITICAL: Ensure UID is exactly the same as original (no regeneration)
  if (!originalEvent.uid) {
    throw new Error('Cannot cancel event without original UID')
  }

  // CRITICAL: Ensure DTSTART and DTEND are exactly the same as original
  if (!originalEvent.start || !originalEvent.end) {
    throw new Error('Cannot cancel event without original start/end times')
  }

  // CRITICAL: Ensure ORGANIZER matches exactly (no fallback)
  if (!originalEvent.organizer?.email) {
    throw new Error('Cannot cancel event without original organizer email')
  }

  return {
    ...originalEvent,
    method: 'CANCEL',
    status: 'CANCELLED',
    sequence: (originalEvent.sequence || 0) + 1,
    // CRITICAL: Preserve organizer exactly as original - no changes allowed
    organizer: {
      name: originalEvent.organizer.name || 'DEDE_SYSTEM',
      email: originalEvent.organizer.email
    },
    // CRITICAL: Preserve start/end times exactly as original - no timezone conversion
    start: originalEvent.start,
    end: originalEvent.end,
    // CRITICAL: Preserve UID exactly as original - no regeneration
    uid: originalEvent.uid
  }
}

/**
 * Common timezone identifiers
 */
export const COMMON_TIMEZONES = {
  'UTC': 'UTC',
  'Asia/Bangkok': 'Asia/Bangkok',
  'Asia/Tokyo': 'Asia/Tokyo',
  'America/New_York': 'America/New_York',
  'America/Los_Angeles': 'America/Los_Angeles',
  'Europe/London': 'Europe/London',
  'Europe/Paris': 'Europe/Paris',
  'Australia/Sydney': 'Australia/Sydney'
} as const

export type TimezoneKey = keyof typeof COMMON_TIMEZONES

/**
 * Helper function to validate RFC5545 basic date-time format
 * Phase 0: Safety setup
 */
export function isBasicDateTime(str: string): boolean {
  // RFC5545 basic format: YYYYMMDDTHHMMSSZ
  const basicDateTimeRegex = /^\d{8}T\d{6}Z$/
  return basicDateTimeRegex.test(str)
}

/**
 * Helper function to build ICS lines with proper formatting
 * Phase 0: Safety setup
 */
export function buildICSLines(lines: string[]): string {
  return lines.join('\r\n')
}

/**
 * Test function to validate cancellation flow
 * This helps ensure proper RFC 5545 compliance for calendar cancellations
 */
export function testCancellationFlow(originalEvent: CalendarEvent): {
  isValid: boolean
  issues: string[]
  cancelledEvent: CalendarEvent
  icsContent: string
} {
  const issues: string[] = []

  // Validate original event has required fields
  if (!originalEvent.uid) {
    issues.push('Original event missing UID')
  }
  if (!originalEvent.start || !originalEvent.end) {
    issues.push('Original event missing start/end times')
  }
  if (!originalEvent.organizer?.email) {
    issues.push('Original event missing organizer email')
  }

  // Create cancelled event
  let cancelledEvent: CalendarEvent
  try {
    cancelledEvent = createCancelledCalendarEvent(originalEvent)
  } catch (error) {
    issues.push(`Failed to create cancelled event: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      isValid: false,
      issues,
      cancelledEvent: originalEvent,
      icsContent: ''
    }
  }

  // Validate cancellation event
  if (cancelledEvent.uid !== originalEvent.uid) {
    issues.push('Cancelled event UID does not match original')
  }
  if (cancelledEvent.start !== originalEvent.start) {
    issues.push('Cancelled event start time does not match original')
  }
  if (cancelledEvent.end !== originalEvent.end) {
    issues.push('Cancelled event end time does not match original')
  }
  if (cancelledEvent.organizer?.email !== originalEvent.organizer?.email) {
    issues.push('Cancelled event organizer does not match original')
  }
  if (cancelledEvent.sequence !== (originalEvent.sequence || 0) + 1) {
    issues.push('Cancelled event sequence is not incremented correctly')
  }
  if (cancelledEvent.method !== 'CANCEL') {
    issues.push('Cancelled event method is not CANCEL')
  }
  if (cancelledEvent.status !== 'CANCELLED') {
    issues.push('Cancelled event status is not CANCELLED')
  }

  // Generate ICS content
  let icsContent = ''
  try {
    icsContent = generateICalContent(cancelledEvent)
  } catch (error) {
    issues.push(`Failed to generate ICS content: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    isValid: issues.length === 0,
    issues,
    cancelledEvent,
    icsContent
  }
}

/**
 * Test function to validate MIME structure for Outlook compatibility
 * This helps ensure proper email rendering while maintaining calendar functionality
 */
export function testMIMEStructure(calendarEvent: CalendarEvent, emailBody: string): {
  isValid: boolean
  issues: string[]
  mimeStructure: {
    hasMultipartMixed: boolean
    hasMultipartAlternative: boolean
    hasTextPlain: boolean
    hasTextHtml: boolean
    hasCalendarAttachment: boolean
    organizerMatchesFrom: boolean
    usesCRLF: boolean
    properContentTypes: boolean
  }
} {
  const issues: string[] = []

  // Test .ics content
  const icsContent = generateICalContent(calendarEvent)
  const calendarInvite = generateCalendarInvite(calendarEvent)

  // Check CRLF line endings
  const usesCRLF = icsContent.includes('\r\n')
  if (!usesCRLF) {
    issues.push('ICS content does not use CRLF line endings as required by RFC 5545')
  }

  // Check organizer consistency
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
  const organizerMatchesFrom = calendarEvent.organizer?.email === fromEmail
  if (!organizerMatchesFrom) {
    issues.push('Organizer email does not match SMTP From address')
  }

  // Check content types
  const properContentTypes = calendarInvite.contentType.includes('text/calendar') &&
    calendarInvite.contentType.includes('charset=UTF-8')
  if (!properContentTypes) {
    issues.push('Calendar attachment does not have proper Content-Type')
  }

  // Check HTML body has inline CSS only (basic check)
  const hasExternalCSS = emailBody.includes('href=') && emailBody.includes('.css')
  if (hasExternalCSS) {
    issues.push('HTML body should use inline CSS only, no external stylesheets')
  }

  // Check for proper MIME structure components
  const mimeStructure = {
    hasMultipartMixed: true, // Will be handled by nodemailer
    hasMultipartAlternative: true, // Will be handled by nodemailer
    hasTextPlain: true, // Will be generated from HTML
    hasTextHtml: emailBody.includes('<') && emailBody.includes('>'),
    hasCalendarAttachment: true, // Will be attached
    organizerMatchesFrom,
    usesCRLF,
    properContentTypes
  }

  if (!mimeStructure.hasTextHtml) {
    issues.push('Email body should contain HTML content for proper rendering')
  }

  return {
    isValid: issues.length === 0,
    issues,
    mimeStructure
  }
}
