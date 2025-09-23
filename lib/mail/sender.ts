import nodemailer from 'nodemailer'
import prisma from '@/prisma/prisma'
import { getFormattedTemplateForBooking, buildTemplateVariablesFromBooking } from './templates'

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

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'DEDE_SYSTEM <no-reply@daikin.co.th>',
    to: toList.join(', '),
    subject,
    [isHtml ? 'html' : 'text']: body,
    headers: {
      'X-Booking-Id': String(bookingId),
      'X-Meeting-Type': String(booking.meetingType),
      'X-Organizer': vars.organizerName || ''
    }
  })

  transporter.close()
}


