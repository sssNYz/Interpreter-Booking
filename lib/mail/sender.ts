import nodemailer from 'nodemailer'
import prisma from '@/prisma/prisma'
import { getFormattedTemplateForBooking, buildTemplateVariablesFromBooking } from './templates'
import { generateCalendarInvite, createCalendarEvent } from './calendar'

function createTransporter() {
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || '10.240.42.47',
      port: Number(process.env.SMTP_PORT || 25),
      secure: false,
      tls: { rejectUnauthorized: false }
    })
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
    tls: { rejectUnauthorized: false }
  })
}

export async function sendApprovalEmailForBooking(bookingId: number): Promise<void> {
  const booking = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    include: { inviteEmails: true }
  })
  if (!booking) return

  const { subject, body, isHtml } = await getFormattedTemplateForBooking(bookingId)
  const vars = await buildTemplateVariablesFromBooking(bookingId)

  const toList: string[] = []
  if (booking.chairmanEmail) toList.push(booking.chairmanEmail)
  if (booking.inviteEmails?.length) toList.push(...booking.inviteEmails.map(i => i.email))

  // Fallback: ensure at least owner email if available via employee relation (optional)
  if (toList.length === 0) {
    const owner = await prisma.employee.findUnique({ where: { empCode: booking.ownerEmpCode } })
    if (owner?.email) toList.push(owner.email)
  }

  if (toList.length === 0) return

  const transporter = createTransporter()
  await transporter.verify()

  // Build .ics from DB timeStart/timeEnd
  const calendarEvent = createCalendarEvent({
    summary: vars.topic || subject,
    start: booking.timeStart,
    end: booking.timeEnd,
    location: booking.meetingRoom || '',
    organizerName: process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM',
    organizerEmail: process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp',
    attendeeEmails: toList,
    method: 'REQUEST'
  })
  const calendarInvite = generateCalendarInvite(calendarEvent)

  // Prepare multipart with calendar attachment similar to send-mail API
  const textBody = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const mailOptions: nodemailer.SendMailOptions = {
    from: `${process.env.SMTP_FROM_NAME || 'DEDE_SYSTEM'} <${process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp'}>`,
    to: toList.join(', '),
    subject,
    alternatives: [
      { contentType: 'text/plain; charset=UTF-8', content: textBody },
      { contentType: 'text/html; charset=UTF-8', content: body },
      { contentType: 'text/calendar; method=REQUEST; charset=UTF-8', content: calendarInvite.content }
    ],
    attachments: [
      {
        filename: 'invite.ics',
        content: calendarInvite.content,
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
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
      'X-MS-OLK-SENDER': process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp',
      'X-MS-OLK-AUTOFORWARD': 'FALSE',
      'X-MS-OLK-AUTOREPLY': 'FALSE',
      'MIME-Version': '1.0',
      'X-Booking-Id': String(bookingId),
      'X-Meeting-Type': String(booking.meetingType),
      'X-Organizer': vars.organizerName || ''
    }
  }

  await transporter.sendMail(mailOptions)

  transporter.close()
}


