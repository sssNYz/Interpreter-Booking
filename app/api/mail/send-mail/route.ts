import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { sendEmailInputSchema, validateEmailDomain, getAllowedEmailDomainSuffix, cleanEmailListNoValidation } from '@/lib/mail/validators'
import { generateCalendarInvite } from '@/lib/mail/calendar'
import { saveInviteMeta, saveInviteIcs } from '@/lib/mail/calendar-store'
// import { generateCalendarInvitationEmail, CalendarInvitationParams } from '@/lib/calendar-invitation-generator'
// DISABLED - Now using beautiful HTML templates instead

type NormalizedSendEmailInput = {
  to: string[]
  cc: string[]
  subject: string
  body: string
  isHtml: boolean
  calendarEvent?: {
    uid?: string
    summary?: string
    start?: string
    end?: string
    organizer?: { name?: string; email?: string }
    attendees?: Array<{ email: string; role?: string; status?: string }>
    method?: string
    sequence?: number
  }
}

/**
 * Create Nodemailer transporter for Daikin internal mail server
 */
function createTransporter() {
  // Use Gmail SMTP for testing when not on internal network
  const isInternalNetwork = process.env.SMTP_HOST === '192.168.212.220'
  
  if (isInternalNetwork) {
    // Internal Daikin SMTP server
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || '192.168.212.220',
      port: parseInt(process.env.SMTP_PORT || '25'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_AUTH_METHOD === 'none' ? undefined : {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_REQUIRE_TLS === 'true'
      }
    })
  } else {
    // Gmail SMTP for external testing
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
      }
    })
  }
}

/**
 * Log email attempt to console
 */
function logEmail(to: string | string[], subject: string, status: 'SUCCESS' | 'FAILED', error?: string) {
  const timestamp = new Date().toISOString()
  const recipients = Array.isArray(to) ? to.join(', ') : to
  console.log(`[${timestamp}] Email ${status}:`, {
    to: recipients,
    subject,
    error: error || null,
  })
}


function normalizeEmails(value: unknown): string[] {
  if (!value) {
    return []
  }

  const values = Array.isArray(value) ? value : [value]

  return values
    .flatMap(item => {
      if (typeof item !== 'string') {
        return []
      }
      return item
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)
    })
}

function normalizePayload(payload: unknown): NormalizedSendEmailInput {
  const p = payload as Record<string, unknown>
  
  const bodyContent = typeof p?.body === 'string'
    ? p.body
    : typeof p?.html === 'string'
      ? p.html
      : typeof p?.text === 'string'
        ? p.text
        : ''

  return {
    to: normalizeEmails(p?.to ?? p?.recipient ?? p?.email),
    cc: normalizeEmails(p?.cc),
    subject: typeof p?.subject === 'string' ? p.subject.trim() : '',
    body: bodyContent,
    isHtml: typeof p?.isHtml === 'boolean' ? p.isHtml : true,
    calendarEvent: p?.calendarEvent || undefined,
  }
}

/**
 * POST /api/send-email
 * Send email through Daikin internal mail server
 */
export async function POST(request: NextRequest) {
  let transporter: nodemailer.Transporter | null = null
  let normalizedInput: NormalizedSendEmailInput | null = null
  
  try {
    const rawBody = await request.json()
    normalizedInput = normalizePayload(rawBody)

    const validationResult = sendEmailInputSchema.safeParse(normalizedInput)

    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map((err: { message: string }) => err.message).join(', ')
      logEmail(normalizedInput.to.length ? normalizedInput.to : 'unknown', normalizedInput.subject || 'unknown', 'FAILED', errorMessage)
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 400 }
      )
    }

    const { to, cc, subject, body: emailBody, isHtml, calendarEvent } = validationResult.data

    // Only validate TO recipients for domain restriction, CC can be any domain
    const invalidDomain = to.find(email => !validateEmailDomain(email))

    if (invalidDomain) {
      const allowedDomain = getAllowedEmailDomainSuffix()
      const errorMessage = `Required recipients must end with ${allowedDomain}`
      logEmail(to, subject, 'FAILED', `${errorMessage}. Invalid: ${invalidDomain}`)
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 400 }
      )
    }

    // Clean CC emails without domain validation
    const cleanCC = cleanEmailListNoValidation(cc)

    // Create transporter
    transporter = createTransporter()
    
    // Verify connection with better error handling
    try {
      await transporter.verify()
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : 'Unknown verification error'
      console.error('SMTP verification failed:', verifyError)
      logEmail(to, subject, 'FAILED', `SMTP connection failed: ${errorMessage}`)
      return NextResponse.json(
        { 
          success: false, 
          error: `SMTP server connection failed. Please check if the mail server is running and accessible. Error: ${errorMessage}` 
        },
        { status: 500 }
      )
    }
    
    // Prepare email options
    const mailOptions: nodemailer.SendMailOptions = {
      from: `${process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'} <${process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'}>`,
      to,
      cc: cleanCC.length ? cleanCC : undefined,
      subject,
      ...(isHtml ? { html: emailBody } : { text: emailBody }),
    }

    // Add calendar invite if provided
    if (calendarEvent) {
      // CRITICAL: Ensure organizer matches SMTP From address for proper recognition
      const fromEmail = process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
      const fromName = process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'

      // CRITICAL: For cancellations, organizer MUST match exactly - no changes allowed
      // For new events, set organizer to match SMTP From
      if (calendarEvent.method !== 'CANCEL') {
        if (!calendarEvent.organizer || calendarEvent.organizer.email !== fromEmail) {
          calendarEvent.organizer = {
            name: fromName,
            email: fromEmail
          }
        }
      } else {
        // For cancellations, validate that organizer matches SMTP From
        if (calendarEvent.organizer?.email !== fromEmail) {
          console.warn(`[CANCELLATION_WARNING] Organizer email mismatch: ${calendarEvent.organizer?.email} vs ${fromEmail}`)
        }
      }

      // Generate .ics calendar invite using the enhanced calendar library
      const calendarInvite = generateCalendarInvite(calendarEvent)
      const method = calendarEvent.method === 'CANCEL' ? 'CANCEL' : 'REQUEST'
      
      // Persist REQUEST metadata to store for future CANCEL
      if ((calendarEvent.method || 'REQUEST') === 'REQUEST' && calendarEvent.uid && calendarEvent.organizer?.email) {
        // Normalize content and handle line folding
        const contentForPersist = calendarInvite.content.replace(/\r?\n/g, '\r\n')

        // Enhanced parser that handles line folding (continuation lines starting with space)
        const unfoldedContent = contentForPersist.replace(/\r\n\s+/g, '')

        const get = (k: string) => {
          const match = unfoldedContent.match(new RegExp(`^${k}:(.*)$`, 'm'))
          return match ? match[1].trim() : ''
        }

        const getLine = (k: string) => {
          const match = unfoldedContent.match(new RegExp(`^${k}[^\r\n]*$`, 'm'))
          return match ? match[0].trim() : ''
        }

        const meta = {
          uid: get('UID') || calendarEvent.uid,
          dtstart: get('DTSTART'),
          dtend: get('DTEND'),
          sequence: parseInt(get('SEQUENCE') || '0', 10),
          organizerLine: getLine('ORGANIZER')
        }

        // Enhanced validation - only require essential fields for cancellation
        if (meta.uid && meta.dtstart && meta.dtend) {
          // If organizerLine is missing, construct it from calendarEvent
          if (!meta.organizerLine && calendarEvent.organizer) {
            const orgName = calendarEvent.organizer.name || 'DEDE_SYSTEM'
            const orgEmail = calendarEvent.organizer.email
            meta.organizerLine = `ORGANIZER;CN=${orgName}:mailto:${orgEmail}`
          }

          saveInviteMeta(meta)
          // Also persist raw ICS content under the hashed UID for troubleshooting/cancel
          try {
            saveInviteIcs(meta.uid, calendarInvite.content)
          } catch (e) {
            console.warn('[STORE] Failed to persist ICS content', e)
          }
          console.log(`[STORE] Saved REQUEST meta for UID: ${meta.uid}`, {
            dtstart: meta.dtstart,
            dtend: meta.dtend,
            sequence: meta.sequence,
            hasOrganizerLine: !!meta.organizerLine
          })
        } else {
          console.warn(`[STORE] Failed to save REQUEST meta - missing essential fields:`, {
            uid: meta.uid,
            dtstart: meta.dtstart,
            dtend: meta.dtend,
            organizerLine: meta.organizerLine,
            icsContentPreview: contentForPersist.substring(0, 500)
          })
        }
      }

      // CRITICAL: Create proper MIME structure for Outlook compatibility
      // Structure: multipart/mixed -> multipart/alternative (text/plain + text/html) + text/calendar attachment
      
      // Create text/plain version (strip HTML tags)
      const textBody = emailBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      
      // Set up proper multipart structure
      mailOptions.alternatives = [
        {
          contentType: 'text/plain; charset=UTF-8',
          content: textBody
        },
        {
          contentType: 'text/html; charset=UTF-8',
          content: emailBody
        },
        {
          contentType: `text/calendar; method=${method}; charset=UTF-8`,
          content: calendarInvite.content
        }
      ]

    // Add .ics file as proper attachment with correct MIME type
      mailOptions.attachments = [
        {
          filename: calendarEvent.method === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
          content: calendarInvite.content,
          contentType: `text/calendar; method=${method}; charset=UTF-8`,
          contentDisposition: 'attachment',
          encoding: 'utf8'
        }
      ]

      // Add calendar headers for proper Outlook recognition
      mailOptions.headers = {
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE',
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-MICROSOFT-CDO-BUSYSTATUS': calendarEvent.method === 'CANCEL' ? 'FREE' : 'BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE': '1',
        'X-MICROSOFT-DISALLOW-COUNTER': 'FALSE',
        'X-MS-HAS-ATTACH': 'TRUE',
        'X-MS-OLK-CONFTYPE': '0',
        'X-MS-OLK-SENDER': fromEmail,
        'X-MS-OLK-AUTOFORWARD': 'FALSE',
        'X-MS-OLK-AUTOREPLY': 'FALSE',
        'MIME-Version': '1.0'
      }

      // Remove the old html/text properties since we're using alternatives
      delete mailOptions.html
      delete mailOptions.text
    }

    const info = await transporter.sendMail(mailOptions)

    // Log success with calendar details if present
    if (calendarEvent) {
      console.log(`[CALENDAR_${calendarEvent.method || 'REQUEST'}] UID: ${calendarEvent.uid || 'generated'}, SEQUENCE: ${calendarEvent.sequence || 0}, Recipients: ${[...to, ...cleanCC].join(', ')}, Status: SENT, MessageID: ${info.messageId}, Organizer: ${calendarEvent.organizer?.email || 'unknown'}, Method: ${calendarEvent.method || 'REQUEST'}`)
    }
    logEmail(to, subject, 'SUCCESS')

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      calendarEvent: calendarEvent ? {
        method: calendarEvent.method || 'REQUEST',
        uid: calendarEvent.uid,
        sequence: calendarEvent.sequence || 0
      } : undefined
    })
    
  } catch (error) {
    console.error('Send email error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const fallbackRecipients = normalizedInput && normalizedInput.to.length ? normalizedInput.to : 'unknown'
    const fallbackSubject = normalizedInput?.subject || 'unknown'

    // Log failure
    logEmail(fallbackRecipients, fallbackSubject, 'FAILED', errorMessage)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    )
  } finally {
    if (transporter) {
      transporter.close()
    }
  }
}

/**
 * GET /api/send-email
 * Get email configuration status
 */
export async function GET() {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    
    return NextResponse.json({
      success: true,
      message: 'SMTP connection verified successfully',
      config: {
        host: process.env.SMTP_HOST || '192.168.212.220',
        port: process.env.SMTP_PORT || '25',
        secure: process.env.SMTP_SECURE || 'false',
        auth: process.env.SMTP_AUTH_METHOD || 'none',
        from: process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp',
      },
    })
  } catch (error) {
    console.error('SMTP verification error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'SMTP verification failed' 
      },
      { status: 500 }
    )
  }
}

