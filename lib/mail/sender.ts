import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'
import prisma from '@/prisma/prisma'
import { getFormattedTemplateForBooking, buildTemplateVariablesFromBooking, getFormattedCancellationTemplateForBooking, buildCancellationTemplateVariablesFromBooking, getTemplateById, formatTemplate } from './templates'
import { generateCalendarInvite, createCalendarEvent, createCancelledCalendarEvent } from './calendar'
import { createTeamsMeeting } from '@/lib/meetings/teams'
import { getAdminEmailsForBooking } from './admin-emails'
function createTransporter() {
  // Handle SMTP_HOST with special check for "0" which should use default
  const envHost = (process.env.SMTP_HOST ?? '').trim()
  const host = (!envHost || envHost === '0') ? '192.168.212.220' : envHost
  const port = parseInt(process.env.SMTP_PORT ?? '25', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const authMethod = (process.env.SMTP_AUTH_METHOD ?? 'none').toLowerCase()
  const auth = authMethod === 'none'
    ? undefined
    : {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  console.log(`[SMTP] Creating transporter with host: ${host}, port: ${port}, secure: ${secure}, auth: ${authMethod}`)
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    tls: { rejectUnauthorized: false }
  })
}
function getOrganizerInfo() {
  return {
    name: process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM',
    email: process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'
  }
}
function getCalendarUid(bookingId: number): string {
  const { email } = getOrganizerInfo()
  const domain = email.includes('@') ? email.split('@')[1] : 'dit.daikin.co.jp'
  return `booking-${bookingId}@${domain}`
}
function toPlainText(content: string): string {
  return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
type BookingWithEmailRelations = Prisma.BookingPlanGetPayload<{
  include: {
    inviteEmails: true
    employee: true
    interpreterEmployee: true
    selectedInterpreter: true
  }
}>
async function getBookingEmailContext(
  bookingId: number,
  preservedInterpreterInfo?: {
    interpreterEmpCode?: string | null
    selectedInterpreterEmpCode?: string | null
    interpreterEmployee?: { empCode: string; email: string | null; firstNameEn: string | null; lastNameEn: string | null } | null
    selectedInterpreter?: { empCode: string; email: string | null; firstNameEn: string | null; lastNameEn: string | null } | null
  }
): Promise<{
  booking: BookingWithEmailRelations
  recipients: string[]
  ccRecipients: string[]
} | null> {
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    include: {
      inviteEmails: true,
      employee: true, // Owner/booker
      interpreterEmployee: true, // Assigned interpreter
      selectedInterpreter: true // Selected interpreter (for President meetings)
    }
  })
  if (!booking) return null

  // If interpreter info was preserved (e.g., for cancellation), use it
  if (preservedInterpreterInfo) {
    if (preservedInterpreterInfo.interpreterEmployee && !booking.interpreterEmployee) {
      // Restore interpreter info that was cleared
      booking.interpreterEmployee = preservedInterpreterInfo.interpreterEmployee as unknown as BookingWithEmailRelations['interpreterEmployee']
      booking.interpreterEmpCode = preservedInterpreterInfo.interpreterEmpCode ?? null
    }
    if (preservedInterpreterInfo.selectedInterpreter && !booking.selectedInterpreter) {
      // Restore selected interpreter info that was cleared
      booking.selectedInterpreter = preservedInterpreterInfo.selectedInterpreter as unknown as BookingWithEmailRelations['selectedInterpreter']
      booking.selectedInterpreterEmpCode = preservedInterpreterInfo.selectedInterpreterEmpCode ?? null
    }
  }
  const recipients = new Set<string>()
  const ccRecipients = new Set<string>()

  // 1. Add the meeting owner/booker (person who created the booking)
  const ownerEmail = booking.employee?.email?.trim()
  if (ownerEmail) {
    recipients.add(ownerEmail)
  }

  // 2. Add the assigned interpreter to CC (if assigned)
  const interpreterEmail = booking.interpreterEmployee?.email?.trim()
  if (interpreterEmail) {
    ccRecipients.add(interpreterEmail)
    console.log(`[EMAIL] Added assigned interpreter to CC: ${interpreterEmail}`)
  }

  // 3. Add the selected interpreter to CC (for President meetings)
  const selectedInterpreterEmail = booking.selectedInterpreter?.email?.trim()
  if (selectedInterpreterEmail) {
    ccRecipients.add(selectedInterpreterEmail)
    console.log(`[EMAIL] Added selected interpreter to CC: ${selectedInterpreterEmail}`)
  }

  // 4. Add chairman email (for DR meetings)
  const chairmanEmail = booking.chairmanEmail?.trim()
  if (chairmanEmail) {
    recipients.add(chairmanEmail)
  }

  // 5. Add all invited attendees from invite_email_list
  booking.inviteEmails?.forEach(invite => {
    const email = invite.email?.trim()
    if (email) {
      recipients.add(email)
    }
  })
  if (recipients.size === 0 && ccRecipients.size === 0) return null
  if (!booking.timeStart || !booking.timeEnd) return null

  // Deduplicate: remove any CC recipients that are already in To recipients (case-insensitive)
  const recipientsLower = new Set(Array.from(recipients).map(e => e.toLowerCase()))
  const deduplicatedCC = Array.from(ccRecipients).filter(cc => !recipientsLower.has(cc.toLowerCase()))

  return {
    booking,
    recipients: Array.from(recipients),
    ccRecipients: deduplicatedCC
  }
}
export async function sendApprovalEmailForBooking(bookingId: number): Promise<void> {
  console.log(`[EMAIL] sendApprovalEmailForBooking called for booking ${bookingId}`)
  const context = await getBookingEmailContext(bookingId)
  if (!context) {
    console.log(`[EMAIL] No context found for booking ${bookingId} - skipping email`)
    return
  }
  const { booking, recipients, ccRecipients } = context

  // Add admin emails to CC
  const adminEmails = await getAdminEmailsForBooking(bookingId)
  if (adminEmails.length > 0) {
    console.log(`[EMAIL] Found ${adminEmails.length} admin emails:`, adminEmails)
    console.log(`[EMAIL] Current TO recipients:`, recipients)
    console.log(`[EMAIL] Current CC recipients:`, ccRecipients)

    const ccSet = new Set(ccRecipients.map(e => e.toLowerCase()))
    const recipientsLower = new Set(recipients.map(e => e.toLowerCase()))

    // Add admins to CC only if they're not already in To or CC
    let addedCount = 0
    let skippedCount = 0
    adminEmails.forEach(adminEmail => {
      const lower = adminEmail.toLowerCase()
      if (!recipientsLower.has(lower) && !ccSet.has(lower)) {
        ccRecipients.push(adminEmail)
        ccSet.add(lower)
        addedCount++
        console.log(`[EMAIL] ✓ Added admin to CC: ${adminEmail}`)
      } else {
        skippedCount++
        console.log(`[EMAIL] ✗ Skipped admin (already in TO or CC): ${adminEmail}`)
      }
    })
    console.log(`[EMAIL] Admin deduplication: ${addedCount} added, ${skippedCount} skipped`)
  }

  console.log(`[EMAIL] Final TO recipients (${recipients.length}):`, recipients)
  console.log(`[EMAIL] Final CC recipients (${ccRecipients.length}):`, ccRecipients)
  const { subject, body, isHtml } = await getFormattedTemplateForBooking(bookingId)
  const vars = await buildTemplateVariablesFromBooking(bookingId)
  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()
  // Try to create a Teams online meeting and get join URL (no DB persistence)
  let teamsJoinUrl: string | null = null
  try {
    console.log('[EMAIL][TEAMS] Attempting to create Teams meeting', {
      enabled: process.env.ENABLE_MS_TEAMS,
      organizerUpn: process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL,
      start: String(booking.timeStart || ''),
      end: String(booking.timeEnd || ''),
      subject: vars.topic || booking.meetingType
    })
    teamsJoinUrl = await createTeamsMeeting({
      start: booking.timeStart,
      end: booking.timeEnd,
      subject: vars.topic || booking.meetingType,
      organizerUpn: process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL || undefined
    })
    console.log('[EMAIL][TEAMS] Created Teams meeting?', { hasUrl: !!teamsJoinUrl, url: teamsJoinUrl })
  } catch (e) {
    console.error('[EMAIL] Error creating Teams meeting (will continue without link):', e)
  }
  // Combine recipients and CC for calendar attendees
  const allAttendees = [...recipients, ...ccRecipients]
  const calendarEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
    description: [
      teamsJoinUrl ? `Microsoft Teams meeting: ${teamsJoinUrl}` : null,
      booking.applicableModel ? `Applicable Model: ${booking.applicableModel}` : null
    ].filter(Boolean).join(' | ') || undefined,
    start: booking.timeStart,
    end: booking.timeEnd,
    timezone: 'Asia/Bangkok',
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: allAttendees,
    method: 'REQUEST',
    sequence: 0
  })
  const calendarInvite = generateCalendarInvite(calendarEvent)
  const teamsBlockHtml = teamsJoinUrl ? `<p><strong>Microsoft Teams:</strong> <a href="${teamsJoinUrl}">Join the meeting</a></p>` : ''
  const teamsBlockText = teamsJoinUrl ? `Microsoft Teams: ${teamsJoinUrl}\n\n` : ''
  const finalHtml = isHtml ? `${teamsBlockHtml}${body}` : undefined
  const textBody = (isHtml ? toPlainText(`${teamsBlockText}${body}`) : `${teamsBlockText}${body}`).trim()
  console.log('[EMAIL][TEAMS] Email composition', {
    hasTeamsUrl: !!teamsJoinUrl,
    htmlHasTeamsBlock: !!teamsBlockHtml,
    icsHasDescription: !!calendarEvent.description
  })
  const transporter = createTransporter()
  try {
    console.log(`[EMAIL] Verifying SMTP connection for approval email...`)
    await transporter.verify()
    console.log(`[EMAIL] SMTP connection verified successfully`)
    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: recipients.join(', '),
      cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
      subject,
      text: textBody,
      html: finalHtml,
      alternatives: [
        { contentType: calendarInvite.contentType, content: calendarInvite.content }
      ],
      attachments: [
        {
          filename: calendarInvite.filename,
          content: calendarInvite.content,
          contentType: calendarInvite.contentType,
          contentDisposition: 'attachment',
          encoding: 'utf8'
        }
      ],
      headers: {
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE',
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-MICROSOFT-CDO-BUSYSTATUS': 'BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE': '1',
        'X-MICROSOFT-DISALLOW-COUNTER': 'FALSE',
        'X-MS-HAS-ATTACH': 'TRUE',
        'X-MS-OLK-CONFTYPE': '0',
        'X-MS-OLK-SENDER': organizerEmail,
        'X-MS-OLK-AUTOFORWARD': 'FALSE',
        'X-MS-OLK-AUTOREPLY': 'FALSE',
        'MIME-Version': '1.0',
        'X-Booking-Id': String(bookingId),
        'X-Meeting-Type': String(booking.meetingType),
        'X-Organizer': vars.organizerName || '',
        'X-Applicable-Model': booking.applicableModel || ''
      }
    }
    await transporter.sendMail(mailOptions)
    console.log(`[EMAIL] Approval email sent successfully for booking ${bookingId}`)
  } catch (error) {
    console.error(`[EMAIL] CRITICAL ERROR sending approval email for booking ${bookingId}:`, error)
    throw error  // Re-throw to propagate the error
  } finally {
    transporter.close()
  }
}
/**
 * Send cancellation email ONLY to the old interpreter when they are replaced
 * This notifies them that their assignment has been canceled
 * Other participants (organizer, attendees) will receive the change notification instead
 */
export async function sendInterpreterReplacementNotification(
  bookingId: number,
  oldInterpreterEmail: string,
  oldInterpreterName: string,
  newInterpreterName: string
): Promise<void> {
  console.log(`[EMAIL] sendInterpreterReplacementNotification called for booking ${bookingId}`)
  console.log(`[EMAIL] Old interpreter: ${oldInterpreterName} (${oldInterpreterEmail})`)
  console.log(`[EMAIL] New interpreter: ${newInterpreterName}`)

  if (!oldInterpreterEmail) {
    console.log(`[EMAIL] No old interpreter email provided - skipping notification`)
    return
  }

  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    include: {
      inviteEmails: true,
      employee: true,
      interpreterEmployee: true,
      selectedInterpreter: true
    }
  })

  if (!booking || !booking.timeStart || !booking.timeEnd) {
    console.log(`[EMAIL] Booking ${bookingId} not found or missing time info - skipping notification`)
    return
  }

  // ONLY send to the old interpreter (no one else)
  const recipients = [oldInterpreterEmail]
  console.log(`[EMAIL] Sending interpreter replacement notification ONLY to old interpreter: ${oldInterpreterEmail}`)

  // Build cancellation reason explaining the replacement
  const reason = `Your interpreter assignment for this meeting has been replaced by ${newInterpreterName}.`

  // Build template variables for cancellation
  const vars = await buildCancellationTemplateVariablesFromBooking(bookingId, reason)

  // Override interpreter section to show the OLD interpreter (the one being canceled)
  const interpreterSection = oldInterpreterName ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💬 Previous Interpreter:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${oldInterpreterName}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💬 New Interpreter:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${newInterpreterName}
                            </td>
                        </tr>` : ''

  vars.interpreterSection = interpreterSection

  // Get the cancellation template and format it with our modified variables
  const template = getTemplateById('unified-cancellation')
  if (!template) throw new Error('Cancellation template not found')

  // Override subject to be specific about interpreter assignment cancellation
  const { body, isHtml } = formatTemplate(template, vars)
  const subject = `Interpreter Assignment Canceled: ${vars.meetingType}${vars.descriptionSubject}`

  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()

  // Create cancellation calendar event (only for the old interpreter)
  const baseEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
    start: booking.timeStart,
    end: booking.timeEnd,
    timezone: 'Asia/Bangkok',
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: [oldInterpreterEmail], // ONLY old interpreter
    method: 'REQUEST',
    sequence: 0
  })
  const cancelledEvent = createCancelledCalendarEvent(baseEvent)
  const calendarInvite = generateCalendarInvite(cancelledEvent)
  const textBody = (isHtml ? toPlainText(body) : body).trim()

  const transporter = createTransporter()
  try {
    console.log(`[EMAIL] Verifying SMTP connection for interpreter replacement notification...`)
    await transporter.verify()
    console.log(`[EMAIL] SMTP connection verified successfully`)

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: oldInterpreterEmail, // ONLY to old interpreter
      subject,
      text: textBody,
      html: isHtml ? body : undefined,
      alternatives: [
        { contentType: calendarInvite.contentType, content: calendarInvite.content }
      ],
      attachments: [
        {
          filename: calendarInvite.filename || 'cancel.ics',
          content: calendarInvite.content,
          contentType: calendarInvite.contentType,
          contentDisposition: 'attachment',
          encoding: 'utf8'
        }
      ],
      headers: {
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE',
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-MICROSOFT-CDO-BUSYSTATUS': 'FREE',
        'X-MICROSOFT-CDO-IMPORTANCE': '1',
        'X-MICROSOFT-DISALLOW-COUNTER': 'FALSE',
        'X-MS-HAS-ATTACH': 'TRUE',
        'X-MS-OLK-CONFTYPE': '0',
        'X-MS-OLK-SENDER': organizerEmail,
        'X-MS-OLK-AUTOFORWARD': 'FALSE',
        'X-MS-OLK-AUTOREPLY': 'FALSE',
        'MIME-Version': '1.0',
        'X-Booking-Id': String(bookingId),
        'X-Meeting-Type': String(booking.meetingType),
        'X-Organizer': vars.organizerName || '',
        'X-Applicable-Model': booking.applicableModel || ''
      }
    }
    await transporter.sendMail(mailOptions)
    console.log(`[EMAIL] Interpreter replacement notification sent successfully to ${oldInterpreterEmail} for booking ${bookingId}`)
  } catch (error) {
    console.error(`[EMAIL] CRITICAL ERROR sending interpreter replacement notification for booking ${bookingId}:`, error)
    throw error
  } finally {
    transporter.close()
  }
}

export async function sendCancellationEmailForBooking(
  bookingId: number,
  reason?: string,
  preservedInterpreterInfo?: {
    interpreterEmpCode?: string | null
    selectedInterpreterEmpCode?: string | null
    interpreterEmployee?: { empCode: string; email: string | null; firstNameEn: string | null; lastNameEn: string | null } | null
    selectedInterpreter?: { empCode: string; email: string | null; firstNameEn: string | null; lastNameEn: string | null } | null
  }
): Promise<void> {
  console.log(`[EMAIL] sendCancellationEmailForBooking called for booking ${bookingId}${reason ? ` with reason: ${reason}` : ''}`)
  const context = await getBookingEmailContext(bookingId, preservedInterpreterInfo)
  if (!context) {
    console.log(`[EMAIL] No context found for booking ${bookingId} - skipping email`)
    return
  }
  const { booking, recipients, ccRecipients } = context

  // Add admin emails to CC
  const adminEmails = await getAdminEmailsForBooking(bookingId)
  if (adminEmails.length > 0) {
    console.log(`[EMAIL] Found ${adminEmails.length} admin emails:`, adminEmails)
    console.log(`[EMAIL] Current TO recipients:`, recipients)
    console.log(`[EMAIL] Current CC recipients:`, ccRecipients)

    const ccSet = new Set(ccRecipients.map(e => e.toLowerCase()))
    const recipientsLower = new Set(recipients.map(e => e.toLowerCase()))

    // Add admins to CC only if they're not already in To or CC
    let addedCount = 0
    let skippedCount = 0
    adminEmails.forEach(adminEmail => {
      const lower = adminEmail.toLowerCase()
      if (!recipientsLower.has(lower) && !ccSet.has(lower)) {
        ccRecipients.push(adminEmail)
        ccSet.add(lower)
        addedCount++
        console.log(`[EMAIL] ✓ Added admin to CC: ${adminEmail}`)
      } else {
        skippedCount++
        console.log(`[EMAIL] ✗ Skipped admin (already in TO or CC): ${adminEmail}`)
      }
    })
    console.log(`[EMAIL] Admin deduplication: ${addedCount} added, ${skippedCount} skipped`)
  }

  console.log(`[EMAIL] Final TO recipients (${recipients.length}):`, recipients)
  console.log(`[EMAIL] Final CC recipients (${ccRecipients.length}):`, ccRecipients)
  const { subject, body, isHtml } = await getFormattedCancellationTemplateForBooking(bookingId, reason)
  const vars = await buildTemplateVariablesFromBooking(bookingId)
  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()
  // Combine recipients and CC for calendar attendees
  const allAttendees = [...recipients, ...ccRecipients]

  const baseEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
    description: booking.applicableModel ? `Applicable Model: ${booking.applicableModel}` : undefined,
    start: booking.timeStart,
    end: booking.timeEnd,
    timezone: 'Asia/Bangkok',
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: allAttendees,
    method: 'REQUEST',
    sequence: 0
  })
  const cancelledEvent = createCancelledCalendarEvent(baseEvent)
  const calendarInvite = generateCalendarInvite(cancelledEvent)
  const textBody = (isHtml ? toPlainText(body) : body).trim()
  const transporter = createTransporter()
  try {
    console.log(`[EMAIL] Verifying SMTP connection for cancellation email...`)
    await transporter.verify()
    console.log(`[EMAIL] SMTP connection verified successfully`)
    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: recipients.join(', '),
      cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
      subject,
      text: textBody,
      html: isHtml ? body : undefined,
      alternatives: [
        { contentType: calendarInvite.contentType, content: calendarInvite.content }
      ],
      attachments: [
        {
          filename: calendarInvite.filename || 'cancel.ics',
          content: calendarInvite.content,
          contentType: calendarInvite.contentType,
          contentDisposition: 'attachment',
          encoding: 'utf8'
        }
      ],
      headers: {
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE',
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-MICROSOFT-CDO-BUSYSTATUS': 'FREE',
        'X-MICROSOFT-CDO-IMPORTANCE': '1',
        'X-MICROSOFT-DISALLOW-COUNTER': 'FALSE',
        'X-MS-HAS-ATTACH': 'TRUE',
        'X-MS-OLK-CONFTYPE': '0',
        'X-MS-OLK-SENDER': organizerEmail,
        'X-MS-OLK-AUTOFORWARD': 'FALSE',
        'X-MS-OLK-AUTOREPLY': 'FALSE',
        'MIME-Version': '1.0',
        'X-Booking-Id': String(bookingId),
        'X-Meeting-Type': String(booking.meetingType),
        'X-Organizer': vars.organizerName || '',
        'X-Applicable-Model': booking.applicableModel || ''
      }
    }
    await transporter.sendMail(mailOptions)
    console.log(`[EMAIL] Cancellation email sent successfully for booking ${bookingId}`)
  } catch (error) {
    console.error(`[EMAIL] CRITICAL ERROR sending cancellation email for booking ${bookingId}:`, error)
    throw error  // Re-throw to propagate the error
  } finally {
    transporter.close()
  }
}

export async function sendChangeNotificationEmail(
  bookingId: number,
  recipients: string[],
  ccRecipients: string[],
  subject: string,
  body: string,
  isHtml: boolean,
  booking: any,
  changes: any
): Promise<void> {
  console.log(`[EMAIL] sendChangeNotificationEmail called for booking ${bookingId}`)

  if (recipients.length === 0 && ccRecipients.length === 0) {
    console.log(`[EMAIL] No recipients for booking ${bookingId} - skipping email`)
    return
  }

  if (!booking.timeStart || !booking.timeEnd) {
    console.log(`[EMAIL] Booking ${bookingId} missing time info - skipping email`)
    return
  }

  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()

  // Try to create a Teams online meeting and get join URL (no DB persistence)
  let teamsJoinUrl: string | null = null
  try {
    console.log('[EMAIL][TEAMS] Attempting to create Teams meeting for change notification', {
      enabled: process.env.ENABLE_MS_TEAMS,
      organizerUpn: process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL,
      start: String(booking.timeStart || ''),
      end: String(booking.timeEnd || ''),
      subject: booking.meetingDetail || booking.meetingType
    })
    teamsJoinUrl = await createTeamsMeeting({
      start: booking.timeStart,
      end: booking.timeEnd,
      subject: booking.meetingDetail || booking.meetingType,
      organizerUpn: process.env.MS_GRAPH_ORGANIZER_UPN || process.env.SMTP_FROM_EMAIL || undefined
    })
    console.log('[EMAIL][TEAMS] Created Teams meeting?', { hasUrl: !!teamsJoinUrl, url: teamsJoinUrl })
  } catch (e) {
    console.error('[EMAIL] Error creating Teams meeting (will continue without link):', e)
  }

  // Combine recipients and CC for calendar attendees
  const allAttendees = [...recipients, ...ccRecipients]

  // Create updated calendar event with incremented sequence
  const calendarEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: booking.meetingDetail || booking.meetingType,
    description: [
      teamsJoinUrl ? `Microsoft Teams meeting: ${teamsJoinUrl}` : null,
      booking.applicableModel ? `Applicable Model: ${booking.applicableModel}` : null
    ].filter(Boolean).join(' | ') || undefined,
    start: booking.timeStart,
    end: booking.timeEnd,
    timezone: 'Asia/Bangkok',
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: allAttendees,
    method: 'REQUEST',
    sequence: 1 // Incremented sequence for updates
  })

  const calendarInvite = generateCalendarInvite(calendarEvent)

  const teamsBlockHtml = teamsJoinUrl ? `<p><strong>Microsoft Teams:</strong> <a href="${teamsJoinUrl}">Join the meeting</a></p>` : ''
  const teamsBlockText = teamsJoinUrl ? `Microsoft Teams: ${teamsJoinUrl}\n\n` : ''

  const finalHtml = isHtml ? `${teamsBlockHtml}${body}` : undefined
  const textBody = (isHtml ? toPlainText(`${teamsBlockText}${body}`) : `${teamsBlockText}${body}`).trim()

  console.log('[EMAIL][TEAMS] Email composition', {
    hasTeamsUrl: !!teamsJoinUrl,
    htmlHasTeamsBlock: !!teamsBlockHtml,
    icsHasDescription: !!calendarEvent.description
  })

  const transporter = createTransporter()
  try {
    console.log(`[EMAIL] Verifying SMTP connection for change notification email...`)
    await transporter.verify()
    console.log(`[EMAIL] SMTP connection verified successfully`)

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: recipients.join(', '),
      cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
      subject,
      text: textBody,
      html: finalHtml,
      alternatives: [
        { contentType: calendarInvite.contentType, content: calendarInvite.content }
      ],
      attachments: [
        {
          filename: calendarInvite.filename,
          content: calendarInvite.content,
          contentType: calendarInvite.contentType,
          contentDisposition: 'attachment',
          encoding: 'utf8'
        }
      ],
      headers: {
        'X-MS-OLK-FORCEINSPECTOROPEN': 'TRUE',
        'Content-Class': 'urn:content-classes:calendarmessage',
        'X-MICROSOFT-CDO-BUSYSTATUS': 'BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE': '1',
        'X-MICROSOFT-DISALLOW-COUNTER': 'FALSE',
        'X-MS-HAS-ATTACH': 'TRUE',
        'X-MS-OLK-CONFTYPE': '0',
        'X-MS-OLK-SENDER': organizerEmail,
        'X-MS-OLK-AUTOFORWARD': 'FALSE',
        'X-MS-OLK-AUTOREPLY': 'FALSE',
        'MIME-Version': '1.0',
        'X-Booking-Id': String(bookingId),
        'X-Meeting-Type': String(booking.meetingType),
        'X-Organizer': booking.employee?.firstNameEn || '',
        'X-Applicable-Model': booking.applicableModel || ''
      }
    }

    await transporter.sendMail(mailOptions)
    console.log(`[EMAIL] Change notification email sent successfully for booking ${bookingId}`)
  } catch (error) {
    console.error(`[EMAIL] CRITICAL ERROR sending change notification email for booking ${bookingId}:`, error)
    throw error  // Re-throw to propagate the error
  } finally {
    transporter.close()
  }
}