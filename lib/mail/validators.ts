import { z } from 'zod'

const DEFAULT_ALLOWED_DOMAIN = '@dit.daikin.co.jp'

function resolveAllowedDomain(): string {
  const configured = process.env.ALLOWED_EMAIL_DOMAIN || process.env.EMAIL_DOMAIN

  if (!configured || configured.length === 0) {
    return DEFAULT_ALLOWED_DOMAIN
  }

  return configured.startsWith('@') ? configured : `@${configured}`
}

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email format')

/**
 * Calendar event attendee validation schema
 */
export const calendarAttendeeSchema = z.object({
  name: z.string().optional(),
  email: emailSchema,
  role: z.enum(['REQ-PARTICIPANT', 'OPT-PARTICIPANT', 'NON-PARTICIPANT']).optional().default('REQ-PARTICIPANT'),
  status: z.enum(['NEEDS-ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE']).optional().default('NEEDS-ACTION'),
})

/**
 * Calendar event validation schema
 */
export const calendarEventSchema = z.object({
  uid: z.string().optional(), // Will be generated if not provided
  summary: z.string().min(1, 'Event summary is required').max(200, 'Summary too long'),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.string().datetime('Invalid start date format'),
  end: z.string().datetime('Invalid end date format'),
  timezone: z.string().optional(),
  organizer: z.object({
    name: z.string().min(1, 'Organizer name is required'),
    email: emailSchema,
  }),
  attendees: z.array(calendarAttendeeSchema).min(1, 'At least one attendee is required'),
  method: z.enum(['REQUEST', 'CANCEL']).optional().default('REQUEST'),
  status: z.enum(['CONFIRMED', 'TENTATIVE', 'CANCELLED']).optional().default('CONFIRMED'),
  sequence: z.number().int().min(0).optional().default(0),
})

/**
 * Send email input validation schema
 */
export const sendEmailInputSchema = z.object({
  to: z.array(emailSchema).min(1, 'At least one recipient is required'),
  cc: z.array(emailSchema).optional().default([]),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  body: z.string().min(1, 'Body is required'),
  isHtml: z.boolean().optional().default(true),
  calendarEvent: calendarEventSchema.optional(),
})

/**
 * Template input validation schema
 */
export const templateInputSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Name too long'),
  category: z.enum(['general', 'training', 'reminder', 'announcement']).default('general'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  body: z.string().min(1, 'Body is required'),
  isSystem: z.boolean().optional().default(false),
})

/**
 * Template update validation schema
 */
export const templateUpdateSchema = templateInputSchema.partial().omit({ isSystem: true })

/**
 * Employee input validation schema
 */
export const employeeInputSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  divDeptSect: z.string().optional(),
})

/**
 * Department group input validation schema
 */
export const departmentGroupInputSchema = z.object({
  groupName: z.string().min(1, 'Group name is required').max(100, 'Name too long'),
  divDeptSect: z.string().optional(),
})

/**
 * Group member input validation schema
 */
export const groupMemberInputSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
})

/**
 * Email domain validation schema
 */
export const emailDomainSchema = z.string().refine(
  (email) => email.endsWith(resolveAllowedDomain()),
  {
    message: `Email must be from the allowed domain: ${resolveAllowedDomain()}`,
  }
)

/**
 * Inferred types from schemas
 */
export type SendEmailInput = z.infer<typeof sendEmailInputSchema>
export type CalendarEvent = z.infer<typeof calendarEventSchema>
export type CalendarAttendee = z.infer<typeof calendarAttendeeSchema>
export type TemplateInput = z.infer<typeof templateInputSchema>
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>
export type EmployeeInput = z.infer<typeof employeeInputSchema>
export type DepartmentGroupInput = z.infer<typeof departmentGroupInputSchema>
export type GroupMemberInput = z.infer<typeof groupMemberInputSchema>

/**
 * Utility helpers for allowed domain configuration
 */
export function getAllowedEmailDomainSuffix(): string {
  return resolveAllowedDomain()
}

/**
 * Utility function to validate email domain
 */
export function validateEmailDomain(email: string): boolean {
  const allowedDomain = resolveAllowedDomain()
  return email.toLowerCase().endsWith(allowedDomain.toLowerCase())
}

/**
 * Utility function to clean and validate email list
 */
export function cleanEmailList(emails: string[]): string[] {
  return emails
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
    .filter(email => validateEmailDomain(email))
    .filter((email, index, array) => array.indexOf(email) === index) // Remove duplicates
}

/**
 * Utility function to clean email list without domain validation (for CC)
 */
export function cleanEmailListNoValidation(emails: string[]): string[] {
  return emails
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
    .filter(email => email.includes('@')) // Basic email format check
    .filter((email, index, array) => array.indexOf(email) === index) // Remove duplicates
}
