import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'
import prisma from '@/prisma/prisma'
import { getFormattedTemplateForBooking, buildTemplateVariablesFromBooking, getFormattedCancellationTemplateForBooking } from './templates'
import { generateCalendarInvite, createCalendarEvent, createCancelledCalendarEvent } from './calendar'
import { createTeamsMeeting } from '@/lib/meetings/teams'
import { getAdminEmailsForBooking } from './admin-emails'
function createTransporter() {
  const host = (process.env.SMTP_HOST ?? '').trim() || '192.168.212.220'
  const port = parseInt(process.env.SMTP_PORT ?? '25', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const authMethod = (process.env.SMTP_AUTH_METHOD ?? 'none').toLowerCase()
  const auth = authMethod === 'none'
    ? undefined
    : {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
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
    console.log(`[EMAIL] Adding ${adminEmails.length} admin emails to CC:`, adminEmails)
    const ccSet = new Set(ccRecipients.map(e => e.toLowerCase()))
    const recipientsLower = new Set(recipients.map(e => e.toLowerCase()))
    
    // Add admins to CC only if they're not already in To or CC
    adminEmails.forEach(adminEmail => {
      const lower = adminEmail.toLowerCase()
      if (!recipientsLower.has(lower) && !ccSet.has(lower)) {
        ccRecipients.push(adminEmail)
        ccSet.add(lower)
      }
    })
  }

  console.log(`[EMAIL] Sending approval email for booking ${bookingId} to ${recipients.length} recipients:`, recipients)
  console.log(`[EMAIL] CC: ${ccRecipients.length} recipients:`, ccRecipients)
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
    description: teamsJoinUrl ? `Microsoft Teams meeting: ${teamsJoinUrl}` : undefined,
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
        'X-Organizer': vars.organizerName || ''
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
    console.log(`[EMAIL] Adding ${adminEmails.length} admin emails to CC:`, adminEmails)
    const ccSet = new Set(ccRecipients.map(e => e.toLowerCase()))
    const recipientsLower = new Set(recipients.map(e => e.toLowerCase()))
    
    // Add admins to CC only if they're not already in To or CC
    adminEmails.forEach(adminEmail => {
      const lower = adminEmail.toLowerCase()
      if (!recipientsLower.has(lower) && !ccSet.has(lower)) {
        ccRecipients.push(adminEmail)
        ccSet.add(lower)
      }
    })
  }

  console.log(`[EMAIL] Sending cancellation email for booking ${bookingId} to ${recipients.length} recipients:`, recipients)
  console.log(`[EMAIL] CC: ${ccRecipients.length} recipients:`, ccRecipients)
  const { subject, body, isHtml } = await getFormattedCancellationTemplateForBooking(bookingId, reason)
  const vars = await buildTemplateVariablesFromBooking(bookingId)
  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()
  // Combine recipients and CC for calendar attendees
  const allAttendees = [...recipients, ...ccRecipients]

  const baseEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
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
        'X-Organizer': vars.organizerName || ''
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
