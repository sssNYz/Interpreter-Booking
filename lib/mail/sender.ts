import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'
import prisma from '@/prisma/prisma'
import { getFormattedTemplateForBooking, buildTemplateVariablesFromBooking, generateCancellationEmailHTML } from './templates'
import { generateCalendarInvite, createCalendarEvent, createCancelledCalendarEvent } from './calendar'

function createTransporter() {
  const host = (process.env.SMTP_HOST ?? '').trim() || '192.168.212.220'
  const port = Number(process.env.SMTP_PORT || 25)

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
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
  }
}>

async function getBookingEmailContext(bookingId: number): Promise<{
  booking: BookingWithEmailRelations
  recipients: string[]
} | null> {
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    include: {
      inviteEmails: true,
      employee: true
    }
  })

  if (!booking) return null

  const recipients = new Set<string>()

  const chairmanEmail = booking.chairmanEmail?.trim()
  if (chairmanEmail) recipients.add(chairmanEmail)

  booking.inviteEmails?.forEach(invite => {
    const email = invite.email?.trim()
    if (email) recipients.add(email)
  })

  if (recipients.size === 0) {
    const ownerEmail = booking.employee?.email?.trim()
    if (ownerEmail) recipients.add(ownerEmail)
  }

  if (recipients.size === 0) return null
  if (!booking.timeStart || !booking.timeEnd) return null

  return {
    booking,
    recipients: Array.from(recipients)
  }
}

export async function sendApprovalEmailForBooking(bookingId: number): Promise<void> {
  const context = await getBookingEmailContext(bookingId)
  if (!context) return

  const { booking, recipients } = context
  const { subject, body, isHtml } = await getFormattedTemplateForBooking(bookingId)
  const vars = await buildTemplateVariablesFromBooking(bookingId)
  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()

  const calendarEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
    start: booking.timeStart,
    end: booking.timeEnd,
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: recipients,
    method: 'REQUEST',
    sequence: 0
  })
  const calendarInvite = generateCalendarInvite(calendarEvent)

  const textBody = (isHtml ? toPlainText(body) : body).trim()

  const transporter = createTransporter()

  try {
    await transporter.verify()

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: recipients.join(', '),
      subject,
      text: textBody,
      html: isHtml ? body : undefined,
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
  } finally {
    transporter.close()
  }
}

export async function sendCancellationEmailForBooking(bookingId: number, reason?: string): Promise<void> {
  const context = await getBookingEmailContext(bookingId)
  if (!context) return

  const { booking, recipients } = context
  const vars = await buildTemplateVariablesFromBooking(bookingId)
  const { name: organizerName, email: organizerEmail } = getOrganizerInfo()

  const baseEvent = createCalendarEvent({
    uid: getCalendarUid(booking.bookingId),
    summary: vars.topic || booking.meetingType,
    start: booking.timeStart,
    end: booking.timeEnd,
    location: booking.meetingRoom || '',
    organizerName,
    organizerEmail,
    attendeeEmails: recipients,
    method: 'REQUEST',
    sequence: 0
  })
  const cancelledEvent = createCancelledCalendarEvent(baseEvent)
  const calendarInvite = generateCalendarInvite(cancelledEvent)

  const emailBody = generateCancellationEmailHTML(
    {
      summary: cancelledEvent.summary,
      start: booking.timeStart instanceof Date ? booking.timeStart.toISOString() : new Date(booking.timeStart).toISOString(),
      end: booking.timeEnd instanceof Date ? booking.timeEnd.toISOString() : new Date(booking.timeEnd).toISOString(),
      location: booking.meetingRoom || ''
    },
    reason
  )
  const textBody = toPlainText(emailBody)
  const subject = `CANCELLED: ${cancelledEvent.summary || vars.topic || booking.meetingType}`

  const transporter = createTransporter()

  try {
    await transporter.verify()

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${organizerName} <${organizerEmail}>`,
      to: recipients.join(', '),
      subject,
      text: textBody,
      html: emailBody,
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
  } finally {
    transporter.close()
  }
}

