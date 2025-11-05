import prisma, { MeetingType } from "@/prisma/prisma"
import type { Prisma } from "@prisma/client"

export interface EmailTemplate {
    id: string
    name: string
    category: string
    subject: string
    body: string
    isHtml: boolean
    isSystem: boolean
}

export const SYSTEM_TEMPLATES: EmailTemplate[] = [
    {
        id: 'unified-meeting',
        name: 'Unified Meeting Invitation',
        category: 'meeting',
        subject: '{meetingType}{descriptionSubject}',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{meetingType} Meeting Invitation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 720px; margin: 0 auto; background: white; border-radius: 14px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, {headerColor1} 0%, {headerColor2} 100%); padding: 30px 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600; line-height: 1.3;">
                {meetingTypeIcon} {topic}
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px 25px;">
            
            <!-- Greeting Block -->
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">
                    <strong>To:</strong> All concerned members,
                </p>
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    I would like to invite you to join the {meetingType} meeting as below.
                </p>
            </div>

            <!-- Date Bar -->
            <div style="margin-bottom: 25px; text-align: center;">
                <span style="background: {headerColor1}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 16px; display: inline-block;">
                    📅 {date}
                </span>
            </div>

            <!-- Agenda Line -->
            <div style="margin-bottom: 25px; padding: 15px; background: #F8FAFC; border-left: 4px solid {headerColor1}; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 500;">
                    📊 ① {topic}
                </p>
            </div>

            <!-- Meeting Details -->
            <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; font-weight: 600; border-bottom: 2px solid {headerColor1}; padding-bottom: 8px;">
                    📝 Meeting Details
                </h3>
                
                <div style="background: #FAFBFC; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB;">
                    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📊 Meeting Type:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {meetingTypeDisplay}
                            </td>
                        </tr>
                        {descriptionSection}
                        {drDetailsSection}
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⏰ Time:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {time}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📍 Location:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {location}
                            </td>
                        </tr>
                        {meetingLinkSection}
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📢 Organizer:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {organizerName}
                            </td>
                        </tr>
                        {chairmanSection}
                        {interpreterSection}
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ☰ Participants:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {participant}
                            </td>
                        </tr>
                        {deviceGroupSection}
                        {applicableModelSection}
                        {departmentSection}
                    </table>
                </div>
            </div>

            <!-- Signature -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0 0 15px 0; color: #0f172a; font-size: 16px;">
                    Thank you & Best regards
                </p>
                <div style="color: #0f172a;">
                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600;">
                        {organizerName}
                    </p>
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #374151;">
                        {organizerDivision}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #374151;">
                        Tel: {organizerPhone}
                    </p>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <div style="background: #F8FAFC; padding: 15px 25px; text-align: center; border-top: 1px solid #E5E7EB;">
            <p style="margin: 0; color: #6B7280; font-size: 12px;">
                This is an automated meeting invitation from Daikin R&D Division
            </p>
        </div>

    </div>
</body>
</html>`,
        isHtml: true,
        isSystem: true
    },
    {
        id: 'unified-cancellation',
        name: 'Unified Meeting Cancellation',
        category: 'cancellation',
        subject: 'CANCELLED: {meetingType}{descriptionSubject}',
        body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{meetingType} Meeting Cancellation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 720px; margin: 0 auto; background: white; border-radius: 14px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600; line-height: 1.3;">
                ❌ {meetingTypeIcon} {meetingType} Meeting Cancelled
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px 25px;">
            
            <!-- Greeting Block -->
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">
                    <strong>To:</strong> All concerned members,
                </p>
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    I regret to inform you that the {meetingType} meeting has been cancelled.
                </p>
            </div>

            <!-- Cancellation Notice -->
            <div style="background: #FEF2F2; border-radius: 8px; padding: 20px; border: 1px solid #FECACA; margin-bottom: 25px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                <p style="margin: 0; color: #DC2626; font-size: 18px; font-weight: 600;">
                    {meetingType} MEETING CANCELLED
                </p>
            </div>

            <!-- Date Bar -->
            <div style="margin-bottom: 25px; text-align: center;">
                <span style="background: #DC2626; color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 16px; display: inline-block;">
                    📅 {date}
                </span>
            </div>

            <!-- Cancelled Meeting Details -->
            <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; font-weight: 600; border-bottom: 2px solid #DC2626; padding-bottom: 8px;">
                    📝 Cancelled Meeting Details
                </h3>
                
                <div style="background: #FAFBFC; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB;">
                    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📊 Meeting Type:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {meetingTypeDisplay}
                            </td>
                        </tr>
                        {descriptionSection}
                        {drDetailsSection}
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⏰ Time:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {time}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📍 Location:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {location}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📢 Organizer:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {organizerName}
                            </td>
                        </tr>
                        {chairmanSection}
                        {interpreterSection}
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ☰ Participants:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                {participant}
                            </td>
                        </tr>
                        {deviceGroupSection}
                        {applicableModelSection}
                        {departmentSection}
                    </table>
                </div>
            </div>

            <!-- Cancellation Reason -->
            {reasonSection}

            <!-- Next Steps -->
            <div style="background: #F0F9FF; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">
                    ℹ️ What happens next:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #1E40AF; font-size: 14px;">
                    <li>This meeting will be automatically removed from your calendar</li>
                    <li>You will be notified if the meeting is rescheduled</li>
                    <li>Please contact the organizer if you have any questions</li>
                </ul>
            </div>

            <!-- Signature -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0 0 15px 0; color: #0f172a; font-size: 16px;">
                    Thank you & Best regards
                </p>
                <div style="color: #0f172a;">
                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600;">
                        {organizerName}
                    </p>
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #374151;">
                        {organizerDivision}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #374151;">
                        Tel: {organizerPhone}
                    </p>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <div style="background: #F8FAFC; padding: 15px 25px; text-align: center; border-top: 1px solid #E5E7EB;">
            <p style="margin: 0; color: #6B7280; font-size: 12px;">
                This is an automated meeting cancellation from Daikin R&D Division
            </p>
        </div>

    </div>
</body>
</html>`,
        isHtml: true,
        isSystem: true
    }
]

export function getTemplateById(id: string): EmailTemplate | undefined {
    return SYSTEM_TEMPLATES.find(template => template.id === id)
}

export function getTemplatesByCategory(category: string): EmailTemplate[] {
    return SYSTEM_TEMPLATES.filter(template => template.category === category)
}

export function getAllTemplates(): EmailTemplate[] {
    return SYSTEM_TEMPLATES
}

export function formatTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string; isHtml: boolean } {
    let subject = template.subject
    let body = template.body

    // Replace variables in subject and body
    Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{${key}}`
        subject = subject.replace(new RegExp(placeholder, 'g'), value)
        body = body.replace(new RegExp(placeholder, 'g'), value)
    })

    return { subject, body, isHtml: template.isHtml }
}

// Unified template mapping - all meeting types use the same template with different variables
export const DEFAULT_TEMPLATE_BY_MEETING_TYPE: Record<MeetingType, string> = {
    DR: 'unified-meeting',
    VIP: 'unified-meeting',
    Weekly: 'unified-meeting',
    General: 'unified-meeting',
    Urgent: 'unified-meeting',
    President: 'unified-meeting',
    Other: 'unified-meeting'
}

export function getTemplateForMeetingType(meetingType: MeetingType): EmailTemplate | undefined {
    const templateId = DEFAULT_TEMPLATE_BY_MEETING_TYPE[meetingType]
    return getTemplateById(templateId)
}

export function getDeviceDRTemplateVariables(): Record<string, string> {
    return {
        topic: 'DC-K/I Altair comply WAF&RDS policies',
        date: '23/Sep/\'25 (Tue)',
        deviceGroup: 'IoT',
        applicableModel: '-',
        drStage: 'DC-K/I',
        time: '15:00-16:00',
        place: 'R&D/ Meeting Room 4&5 (Floor 4) or Microsoft Team meeting',
        chairman: 'Mr. Nomura Yoshihide',
        participant: 'R&D/DEDE, MKQ, DIT/IT and DIL/ITS',
        organizerName: 'DEDE_SYSTEM',
        organizerDivision: 'R&D DIVISION / DEVICE GROUP',
        organizerPhone: '0-3846-9700 #7650'
    }
}

// Generic variables helper for non-DR meeting types
export function getGenericMeetingTemplateVariables(): Record<string, string> {
    return {
        topic: 'Meeting Topic',
        date: 'dd/MMM/\'yy (EEE)',
        time: 'HH:mm–HH:mm',
        location: 'Meeting Room / Teams',
        organizer: 'Organizer',
        organizerName: 'Organizer'
    }
}

// ===== DB-backed variable builders =====
function formatGbDateWithWeekday(date: Date): string {
    return date
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
        .replace(/(\d+)\/(\w+)\/(\d+)/, '$1/$2/\'$3') +
        ` (${date.toLocaleDateString('en-US', { weekday: 'short' })})`
}

function formatTimeRange(start: Date, end: Date): string {
    const s = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    const e = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${s}–${e}`
}

// Meeting type configurations for unified template
const MEETING_TYPE_CONFIG = {
    DR: {
        icon: '🎯',
        headerColor1: '#00A0E9',
        headerColor2: '#0078C7',
        displayName: 'Device Review (DR)'
    },
    VIP: {
        icon: '⭐',
        headerColor1: '#7C3AED',
        headerColor2: '#5B21B6',
        displayName: 'VIP'
    },
    Weekly: {
        icon: '📅',
        headerColor1: '#059669',
        headerColor2: '#047857',
        displayName: 'Weekly'
    },
    General: {
        icon: '📊',
        headerColor1: '#4F46E5',
        headerColor2: '#3730A3',
        displayName: 'General'
    },
    Urgent: {
        icon: '🚨',
        headerColor1: '#DC2626',
        headerColor2: '#B91C1C',
        displayName: 'Urgent'
    },
    President: {
        icon: '👑',
        headerColor1: '#B45309',
        headerColor2: '#92400E',
        displayName: 'President'
    },
    Other: {
        icon: '📝',
        headerColor1: '#6B7280',
        headerColor2: '#4B5563',
        displayName: 'Other'
    }
}

// DR sub-type display mapping
const DR_SUBTYPE_DISPLAY = {
    DR_PR: 'DR-PR',
    DR_k: 'DR-k',
    DR_II: 'DR-II',
    DR_I: 'DR-I',
    Other: 'Custom DR Type'
}

type BookingWithRelations = Prisma.BookingPlanGetPayload<{
    include: {
        employee: true
        inviteEmails: true
        interpreterEmployee: true
        selectedInterpreter: true
    }
}>

type BookingWithRelationsPlus = BookingWithRelations & { meetingLink?: string | null }

export async function buildTemplateVariablesFromBooking(
    bookingId: number,
    providedBooking?: BookingWithRelations
): Promise<Record<string, string>> {
    const booking: BookingWithRelations | null = providedBooking ?? await prisma.bookingPlan.findUnique({
        where: { bookingId },
        include: {
            employee: true, // owner
            inviteEmails: true,
            interpreterEmployee: true, // assigned interpreter
            selectedInterpreter: true, // selected interpreter (for President meetings)
        }
    })
    if (!booking) throw new Error(`Booking not found: ${bookingId}`)

    const start = new Date(booking.timeStart)
    const end = new Date(booking.timeEnd)

    const meetingType = booking.meetingType as MeetingType
    const config = MEETING_TYPE_CONFIG[meetingType]
    const isDR = meetingType === 'DR'

    // Build topic for email/calendar: "Type - Detail" when detail exists
    const topic = booking.meetingDetail && booking.meetingDetail.trim().length > 0
        ? `${meetingType} - ${booking.meetingDetail}`
        : meetingType

    // Build description section
    const description = booking.meetingDetail || ''

    // Build description for subject line: "MeetingType - Description"
    const descriptionSubject = description ? ` - ${description}` : ''
    const descriptionSection = description ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📝 Description:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${description}
                            </td>
                        </tr>` : ''

    // Build participants list - include everyone
    const participantsList = new Set<string>()

    // Add owner/booker
    const ownerEmail = booking.employee?.email?.trim()
    if (ownerEmail) participantsList.add(ownerEmail)

    // Add assigned interpreter
    const interpreterEmail = booking.interpreterEmployee?.email?.trim()
    if (interpreterEmail) participantsList.add(interpreterEmail)

    // Add selected interpreter (for President meetings)
    const selectedInterpreterEmail = booking.selectedInterpreter?.email?.trim()
    if (selectedInterpreterEmail) participantsList.add(selectedInterpreterEmail)

    // Add chairman
    if (booking.chairmanEmail?.trim()) participantsList.add(booking.chairmanEmail.trim())

    // Add all invited attendees
    booking.inviteEmails?.forEach((invite) => {
        const email = invite.email?.trim()
        if (email) participantsList.add(email)
    })

    const participant = participantsList.size > 0
        ? Array.from(participantsList).join(', ')
        : 'To be confirmed'

    // Build interpreter section
    const interpreterName = booking.interpreterEmployee
        ? [booking.interpreterEmployee.firstNameEn, booking.interpreterEmployee.lastNameEn].filter(Boolean).join(' ') || booking.interpreterEmployee.email
        : (booking.selectedInterpreter
            ? [booking.selectedInterpreter.firstNameEn, booking.selectedInterpreter.lastNameEn].filter(Boolean).join(' ') || booking.selectedInterpreter.email
            : '')

    const interpreterSection = interpreterName ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💬 Interpreter:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${interpreterName}
                            </td>
                        </tr>` : ''

    // Build organizer info
    const organizerName = booking.employee
        ? [booking.employee.firstNameEn, booking.employee.lastNameEn].filter(Boolean).join(' ') || (booking.employee.email ?? booking.ownerEmpCode)
        : booking.ownerEmpCode

    const organizerDivision = booking.employee?.deptPath ?? ''
    const organizerPhone = booking.employee?.telExt ?? ''

    // Build DR-specific sections
    let drDetailsSection = ''
    let chairmanSection = ''
    let meetingTypeDisplay = config.displayName

    if (isDR) {
        // Handle DR sub-types - ALL DR sub-types are supported
        const drSubtype = booking.drType
        const drSubtypeDisplay = drSubtype ? (DR_SUBTYPE_DISPLAY as Record<string, string>)[drSubtype] || drSubtype : 'Not specified'

        // If DR sub-type is "Other", use the custom otherType text
        const finalDrDisplay = (drSubtype === 'Other' && booking.otherType)
            ? booking.otherType
            : drSubtypeDisplay

        meetingTypeDisplay = `${config.displayName} - ${finalDrDisplay}`

        drDetailsSection = `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⚙️ Applicable Model:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.applicableModel || 'Not specified'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🎯 DR Stage:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${finalDrDisplay}
                            </td>
                        </tr>`

        if (booking.chairmanEmail) {
            chairmanSection = `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💼 Chairman:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.chairmanEmail}
                            </td>
                        </tr>`
        }
    } else if (meetingType === 'Other' && booking.otherType) {
        meetingTypeDisplay = `${config.displayName} - ${booking.otherType}`
    }

    // Build department section - only show if organizerDivision has a value
    const departmentSection = organizerDivision ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🏢 Department:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${organizerDivision}
                            </td>
                        </tr>` : ''

    // Build device group section - show for all meetings (not just DR)
    const deviceGroupSection = booking.ownerGroup ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🏷️ Device Group:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.ownerGroup}
                            </td>
                        </tr>` : ''

    // Build applicable model section for non-DR meetings

    // Build applicable model section for non-DR meetings
    const applicableModelSection = (!isDR && booking.applicableModel) ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⚙️ Applicable Model:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.applicableModel}
                            </td>
                        </tr>` : ''

    // Meeting link section (optional)
    const meetingLinkValue = (booking as BookingWithRelationsPlus).meetingLink
    const meetingLinkSection = meetingLinkValue ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🔗 Meeting Link:
                            </td>
                            <td style="padding: 10px 0; color: #374151; word-break: break-all;">
                                <a href="${meetingLinkValue}" target="_blank" rel="noopener noreferrer">Join meeting</a>
                                <div style="color:#6B7280; font-size:12px; margin-top:4px;">${meetingLinkValue}</div>
                            </td>
                        </tr>` : ''

    return {
        // Meeting type specific
        meetingType: meetingType,
        meetingTypeDisplay: meetingTypeDisplay,
        meetingTypeIcon: config.icon,
        headerColor1: config.headerColor1,
        headerColor2: config.headerColor2,

        // Common fields
        topic,
        descriptionSubject,
        date: formatGbDateWithWeekday(start),
        time: formatTimeRange(start, end),
        location: booking.meetingRoom,
        organizerName,
        organizerDivision,
        organizerPhone,
        participant,

        // Dynamic sections
        descriptionSection,
        drDetailsSection,
        chairmanSection,
        interpreterSection,
        deviceGroupSection,
        applicableModelSection,
        departmentSection,
        meetingLinkSection,

        // Legacy fields (for backward compatibility)
        organizer: organizerName,
        deviceGroup: booking.ownerGroup || '',
        applicableModel: booking.applicableModel || '-',
        drStage: isDR ? (booking.drType ?? (booking.otherType ?? '-')) : '-',
        place: booking.meetingRoom,
        chairman: booking.chairmanEmail ?? '',

        // Additional field for meeting room compatibility
        meetingRoom: booking.meetingRoom,
    }
}

export async function getFormattedTemplateForBooking(bookingId: number): Promise<{ subject: string; body: string; isHtml: boolean }> {
    const booking = await prisma.bookingPlan.findUnique({ where: { bookingId } })
    if (!booking) throw new Error(`Booking not found: ${bookingId}`)
    const template = getTemplateForMeetingType(booking.meetingType as MeetingType)
    if (!template) throw new Error(`No template configured for meeting type: ${booking.meetingType}`)
    const variables = await buildTemplateVariablesFromBooking(bookingId)
    return formatTemplate(template, variables)
}

export async function buildCancellationTemplateVariablesFromBooking(
    bookingId: number,
    reason?: string,
    providedBooking?: BookingWithRelations
): Promise<Record<string, string>> {
    const booking: BookingWithRelations | null = providedBooking ?? await prisma.bookingPlan.findUnique({
        where: { bookingId },
        include: {
            employee: true, // owner
            inviteEmails: true,
            interpreterEmployee: true, // assigned interpreter
            selectedInterpreter: true, // selected interpreter (for President meetings)
        }
    })
    if (!booking) throw new Error(`Booking not found: ${bookingId}`)

    const start = new Date(booking.timeStart)
    const end = new Date(booking.timeEnd)

    const meetingType = booking.meetingType as MeetingType
    const config = MEETING_TYPE_CONFIG[meetingType]
    const isDR = meetingType === 'DR'

    // Build topic for email/calendar: "Type - Detail" when detail exists
    const topic = booking.meetingDetail && booking.meetingDetail.trim().length > 0
        ? `${meetingType} - ${booking.meetingDetail}`
        : meetingType

    // Build description section
    const description = booking.meetingDetail || ''

    // Build description for subject line: "MeetingType - Description"
    const descriptionSubject = description ? ` - ${description}` : ''
    const descriptionSection = description ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📝 Description:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${description}
                            </td>
                        </tr>` : ''

    // Build participants list - include everyone
    const participantsList = new Set<string>()

    // Add owner/booker
    const ownerEmail = booking.employee?.email?.trim()
    if (ownerEmail) participantsList.add(ownerEmail)

    // Add assigned interpreter
    const interpreterEmail = booking.interpreterEmployee?.email?.trim()
    if (interpreterEmail) participantsList.add(interpreterEmail)

    // Add selected interpreter (for President meetings)
    const selectedInterpreterEmail = booking.selectedInterpreter?.email?.trim()
    if (selectedInterpreterEmail) participantsList.add(selectedInterpreterEmail)

    // Add chairman
    if (booking.chairmanEmail?.trim()) participantsList.add(booking.chairmanEmail.trim())

    // Add all invited attendees
    booking.inviteEmails?.forEach((invite) => {
        const email = invite.email?.trim()
        if (email) participantsList.add(email)
    })

    const participant = participantsList.size > 0
        ? Array.from(participantsList).join(', ')
        : 'To be confirmed'

    // Build interpreter section - ALWAYS show if there's an interpreter assigned
    const interpreterName = booking.interpreterEmployee
        ? [booking.interpreterEmployee.firstNameEn, booking.interpreterEmployee.lastNameEn].filter(Boolean).join(' ') || booking.interpreterEmployee.email || 'Interpreter assigned'
        : (booking.selectedInterpreter
            ? [booking.selectedInterpreter.firstNameEn, booking.selectedInterpreter.lastNameEn].filter(Boolean).join(' ') || booking.selectedInterpreter.email || 'Interpreter assigned'
            : '')

    const interpreterSection = (interpreterName || booking.interpreterEmployee || booking.selectedInterpreter) ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💬 Interpreter:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${interpreterName || 'Interpreter assigned'}
                            </td>
                        </tr>` : ''

    // Build organizer info
    const organizerName = booking.employee
        ? [booking.employee.firstNameEn, booking.employee.lastNameEn].filter(Boolean).join(' ') || (booking.employee.email ?? booking.ownerEmpCode)
        : booking.ownerEmpCode

    const organizerDivision = booking.employee?.deptPath ?? ''
    const organizerPhone = booking.employee?.telExt ?? ''

    // Build DR-specific sections
    let drDetailsSection = ''
    let chairmanSection = ''
    let meetingTypeDisplay = config.displayName

    if (isDR) {
        // Handle DR sub-types - ALL DR sub-types are supported
        const drSubtype = booking.drType
        const drSubtypeDisplay = drSubtype ? (DR_SUBTYPE_DISPLAY as Record<string, string>)[drSubtype] || drSubtype : 'Not specified'

        // If DR sub-type is "Other", use the custom otherType text
        const finalDrDisplay = (drSubtype === 'Other' && booking.otherType)
            ? booking.otherType
            : drSubtypeDisplay

        meetingTypeDisplay = `${config.displayName} - ${finalDrDisplay}`

        drDetailsSection = `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⚙️ Applicable Model:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.applicableModel || 'Not specified'}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🎯 DR Stage:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${finalDrDisplay}
                            </td>
                        </tr>`

        if (booking.chairmanEmail) {
            chairmanSection = `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                💼 Chairman:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.chairmanEmail}
                            </td>
                        </tr>`
        }
    } else if (meetingType === 'Other' && booking.otherType) {
        meetingTypeDisplay = `${config.displayName} - ${booking.otherType}`
    }

    // Build department section - only show if organizerDivision has a value
    const departmentSection = organizerDivision ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🏢 Department:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${organizerDivision}
                            </td>
                        </tr>` : ''

    // Build device group section - show for all meetings (not just DR)
    const deviceGroupSection = booking.ownerGroup ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🏷️ Device Group:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.ownerGroup}
                            </td>
                        </tr>` : ''

    // Build applicable model section for non-DR meetings
    const applicableModelSection = (!isDR && booking.applicableModel) ? `
                        <tr>
                            <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⚙️ Applicable Model:
                            </td>
                            <td style="padding: 10px 0; color: #374151;">
                                ${booking.applicableModel}
                            </td>
                        </tr>` : ''

    // Build reason section
    let reasonSection = ''
    if (reason) {
        reasonSection = `
            <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #92400E; font-size: 14px; font-weight: 600;">
                    📝 Reason for cancellation:
                </p>
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                    ${reason}
                </p>
            </div>`
    }

    return {
        // Meeting type specific
        meetingType: meetingType,
        meetingTypeDisplay: meetingTypeDisplay,
        meetingTypeIcon: config.icon,
        headerColor1: config.headerColor1,
        headerColor2: config.headerColor2,

        // Common fields
        topic,
        descriptionSubject,
        date: formatGbDateWithWeekday(start),
        time: formatTimeRange(start, end),
        location: booking.meetingRoom,
        organizerName,
        organizerDivision,
        organizerPhone,
        participant,

        // Dynamic sections
        descriptionSection,
        drDetailsSection,
        chairmanSection,
        interpreterSection,
        deviceGroupSection,
        applicableModelSection,
        departmentSection,
        reasonSection,

        // Legacy fields (for backward compatibility)
        organizer: organizerName,
        deviceGroup: booking.ownerGroup || '',
        applicableModel: booking.applicableModel || '-',
        drStage: isDR ? (booking.drType ?? (booking.otherType ?? '-')) : '-',
        place: booking.meetingRoom,
        chairman: booking.chairmanEmail ?? '',

        // Additional field for meeting room compatibility
        meetingRoom: booking.meetingRoom,
    }
}

export async function getFormattedCancellationTemplateForBooking(
    bookingId: number,
    reason?: string,
    providedBooking?: BookingWithRelations
): Promise<{ subject: string; body: string; isHtml: boolean }> {
    const template = getTemplateById('unified-cancellation')
    if (!template) throw new Error('Unified cancellation template not found')
    const variables = await buildCancellationTemplateVariablesFromBooking(bookingId, reason, providedBooking)
    return formatTemplate(template, variables)
}

// Legacy function for backward compatibility - now uses unified template
export function generateCancellationEmailHTML(event: { start?: string; end?: string; summary?: string; location?: string }, reason?: string): string {
    const startDate = event.start ? new Date(event.start) : new Date()
    const endDate = event.end ? new Date(event.end) : new Date()

    const meetingDate = startDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
    }).replace(/(\d+)\/(\w+)\/(\d+)/, '$1/$2/\'$3')
    const meetingDay = startDate.toLocaleDateString('en-US', {
        weekday: 'short'
    })
    const meetingTime = `${startDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })}–${endDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    })}`

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Cancellation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">
                ❌ Meeting Cancelled
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 25px;">
            
            <!-- Greeting -->
            <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Dear All,
                </p>
                <p style="margin: 10px 0 0 0; color: #0f172a; font-size: 16px;">
                    I regret to inform you that the following meeting has been cancelled:
                </p>
            </div>

            <!-- Cancellation Notice -->
            <div style="background: #FEF2F2; border-radius: 8px; padding: 20px; border: 1px solid #FECACA; margin-bottom: 25px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                <p style="margin: 0; color: #DC2626; font-size: 18px; font-weight: 600;">
                    MEETING CANCELLED
                </p>
            </div>

            <!-- Meeting Info Card -->
            <div style="background: #F8FAFC; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB; margin-bottom: 25px;">
                <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📊 Topic:
                        </td>
                        <td style="padding: 10px 0; color: #374151;">
                            ${event.summary || 'Untitled Event'}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📅 Date:
                        </td>
                        <td style="padding: 10px 0; color: #374151;">
                            ${meetingDate} (${meetingDay})
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            ⏰ Time:
                        </td>
                        <td style="padding: 10px 0; color: #374151;">
                            ${meetingTime}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📍 Location:
                        </td>
                        <td style="padding: 10px 0; color: #374151;">
                            ${event.location || 'TBD'}
                        </td>
                    </tr>
                </table>
            </div>

            ${reason ? `
            <!-- Cancellation Reason -->
            <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #92400E; font-size: 14px; font-weight: 600;">
                    📝 Reason for cancellation:
                </p>
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                    ${reason}
                </p>
            </div>
            ` : ''}

            <!-- Next Steps -->
            <div style="background: #F0F9FF; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #1E40AF; font-size: 14px; font-weight: 600;">
                    ℹ️ What happens next:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #1E40AF; font-size: 14px;">
                    <li>This meeting will be automatically removed from your calendar</li>
                    <li>You will be notified if the meeting is rescheduled</li>
                    <li>Please contact the organizer if you have any questions</li>
                </ul>
            </div>

            <!-- Signature -->
            <div style="padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Best regards,<br>
                    <strong>DEDE_SYSTEM</strong>
                </p>
            </div>

        </div>

    </div>
</body>
</html>`
}