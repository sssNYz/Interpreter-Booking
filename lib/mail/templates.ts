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
    id: 'device-dr-meeting',
    name: 'Device DR Meeting Invitation',
    category: 'meeting',
    subject: 'Device DR Meeting - {topic}',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device DR Meeting Invitation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 720px; margin: 0 auto; background: white; border-radius: 14px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #00A0E9 0%, #0078C7 100%); padding: 30px 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Device DR Meeting – {topic}
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px 25px;">
            
            <!-- Greeting Block -->
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">
                    <strong>To:</strong> All concern member,
                </p>
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    I would like to invite you to join Device DR meeting as below.
                </p>
            </div>

            <!-- Date Bar -->
            <div style="margin-bottom: 25px; text-align: center;">
                <span style="background: #00A0E9; color: white; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 16px; display: inline-block;">
                    📅 {date}
                </span>
            </div>

            <!-- Agenda Line -->
            <div style="margin-bottom: 25px; padding: 15px; background: #F8FAFC; border-left: 4px solid #00A0E9; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 500;">
                    📋 ① {topic}
                </p>
            </div>

            <!-- Meeting Details -->
            <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; font-weight: 600; border-bottom: 2px solid #00A0E9; padding-bottom: 8px;">
                    📝 Meeting Details
                </h3>
                
                <div style="background: #FAFBFC; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB;">
                    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🏷️ Device Group:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {deviceGroup}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📱 Applicable Model:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {applicableModel}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                🎯 DR (Stage):
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {drStage}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                ⏰ Time:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {time}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                📍 Place:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {place}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                👨‍💼 Chairman:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {chairman}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; width: 140px; font-weight: 600; color: #0f172a; vertical-align: top;">
                                👥 Participant:
                            </td>
                            <td style="padding: 8px 0; color: #374151;">
                                {participant}
                            </td>
                        </tr>
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
                        Tel : {organizerPhone}
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
    id: 'general-meeting',
    name: 'General Meeting Invitation',
    category: 'meeting',
    subject: 'Meeting Invitation - {topic}',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Invitation</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">
                📅 Meeting Invitation
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
                    I would like to invite you to join the following meeting:
                </p>
            </div>

            <!-- Meeting Info Card -->
            <div style="background: #F8FAFC; border-radius: 8px; padding: 20px; border: 1px solid #E5E7EB; margin-bottom: 25px;">
                <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📋 Topic:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {topic}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📅 Date:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {date}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            ⏰ Time:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {time}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📍 Location:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {location}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            👤 Organizer:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {organizer}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Message -->
            <div style="margin-bottom: 25px;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Please let me know if you have any questions.
                </p>
            </div>

            <!-- Signature -->
            <div style="padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Best regards,<br>
                    <strong>{organizerName}</strong>
                </p>
            </div>

        </div>

    </div>
</body>
</html>`,
    isHtml: true,
    isSystem: true
  },
  {
    id: 'announcement',
    name: 'General Announcement',
    category: 'announcement',
    subject: 'Announcement - {topic}',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>General Announcement</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">
                📢 General Announcement
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 25px;">
            
            <!-- Greeting -->
            <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Dear All,
                </p>
            </div>

            <!-- Message -->
            <div style="background: #F0FDF4; border-radius: 8px; padding: 20px; border-left: 4px solid #059669; margin-bottom: 25px;">
                <p style="margin: 0; color: #0f172a; font-size: 16px; line-height: 1.6;">
                    {message}
                </p>
            </div>

            <!-- Call to Action -->
            <div style="margin-bottom: 25px;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Please let me know if you have any questions.
                </p>
            </div>

            <!-- Signature -->
            <div style="padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Best regards,<br>
                    <strong>{organizerName}</strong>
                </p>
            </div>

        </div>

    </div>
</body>
</html>`,
    isHtml: true,
    isSystem: true
  },
  {
    id: 'reminder',
    name: 'Meeting Reminder',
    category: 'reminder',
    subject: 'Reminder: {topic}',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Reminder</title>
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F5F8FC; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 25px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">
                ⏰ Meeting Reminder
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
                    This is a reminder about the upcoming meeting:
                </p>
            </div>

            <!-- Meeting Info Card -->
            <div style="background: #FEF2F2; border-radius: 8px; padding: 20px; border: 1px solid #FECACA; margin-bottom: 25px;">
                <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📋 Topic:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {topic}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📅 Date:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {date}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            ⏰ Time:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {time}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📍 Location:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {location}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Call to Action -->
            <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin-bottom: 25px; text-align: center;">
                <p style="margin: 0; color: #92400E; font-size: 16px; font-weight: 600;">
                    ⚠️ Please confirm your attendance
                </p>
            </div>

            <!-- Signature -->
            <div style="padding-top: 20px; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; color: #0f172a; font-size: 16px;">
                    Best regards,<br>
                    <strong>{organizerName}</strong>
                </p>
            </div>

        </div>

    </div>
</body>
</html>`,
    isHtml: true,
    isSystem: true
  },
  {
    id: 'meeting-cancellation',
    name: 'Meeting Cancellation',
    category: 'cancellation',
    subject: 'CANCELLED: {topic}',
    body: `<!DOCTYPE html>
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
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📋 Topic:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {topic}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📅 Date:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {date}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            ⏰ Time:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {time}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📍 Location:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            {location}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Cancellation Reason -->
            {reason && (
              <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #92400E; font-size: 14px; font-weight: 600;">
                    📝 Reason for cancellation:
                </p>
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                    {reason}
                </p>
              </div>
            )}

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
                    <strong>{organizerName}</strong>
                </p>
            </div>

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
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📋 Topic:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            ${event.summary || 'Untitled Event'}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📅 Date:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            ${meetingDate} (${meetingDay})
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            ⏰ Time:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
                            ${meetingTime}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; width: 100px; font-weight: 600; color: #0f172a; vertical-align: top;">
                            📍 Location:
                        </td>
                        <td style="padding: 8px 0; color: #374151;">
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
