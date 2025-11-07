/**
 * Unified Apply Endpoint
 * 
 * This endpoint handles the "Apply" action for booking changes.
 * It detects all changes (interpreter, time, room) and sends a single combined email.
 * 
 * Key Principles:
 * - Save = Draft (no email)
 * - Apply = Commit (send email if changes detected)
 * - Single combined email for all changes
 * - No duplicate emails
 * 
 * See EMAIL_CONSOLIDATION_PLAN.md for architecture details
 */

import { NextResponse } from 'next/server'
import prisma from '@/prisma/prisma'
import {
  detectBookingChanges,
  hasAnyChanges,
  getFormattedChangeTemplateForBooking,
  buildChangeTypesString,
  type BookingChanges
} from '@/lib/mail/templates'
import { getAdminEmailsForBooking } from '@/lib/mail/admin-emails'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type BookingWithRelations = Awaited<ReturnType<typeof prisma.bookingPlan.findUnique>> & {
  employee: any
  inviteEmails: any[]
  interpreterEmployee: any
  selectedInterpreter: any
}

/**
 * POST /api/booking-data/[id]/apply
 * 
 * Apply all pending changes and send change notification email if needed
 * 
 * Request body (optional):
 * {
 *   "oldBookingSnapshot": { ... } // Optional: provide old booking state for comparison
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "changesDetected": boolean,
 *   "changes": BookingChanges,
 *   "emailSent": boolean
 * }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const bookingId = parseInt(id, 10)

    if (!Number.isInteger(bookingId)) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Invalid booking id' },
        { status: 400 }
      )
    }

    // Parse request body (optional old booking snapshot)
    let requestBody: { oldBookingSnapshot?: any } = {}
    try {
      requestBody = await req.json().catch(() => ({}))
    } catch {
      // Empty body is fine
    }

    // Fetch current booking with all relations
    const currentBooking = await prisma.bookingPlan.findUnique({
      where: { bookingId },
      include: {
        employee: true,
        inviteEmails: true,
        interpreterEmployee: true,
        selectedInterpreter: true,
      }
    })

    if (!currentBooking) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if booking is in a state that allows changes
    if (currentBooking.bookingStatus === 'cancel') {
      return NextResponse.json(
        { error: 'POLICY_VIOLATION', message: 'Cannot apply changes to cancelled booking' },
        { status: 422 }
      )
    }

    // For now, we'll use a simple approach: check if there's a "last applied" timestamp
    // If not, this is the first apply (no changes to detect)
    // In a full implementation, you'd store the old state or use a version field
    
    // TODO: Implement proper old state tracking
    // For now, we'll skip change detection if no old snapshot provided
    if (!requestBody.oldBookingSnapshot) {
      console.log(`[APPLY] No old booking snapshot provided for booking ${bookingId}`)
      console.log(`[APPLY] Skipping change detection - this may be first apply or old state not tracked`)
      
      return NextResponse.json({
        success: true,
        changesDetected: false,
        emailSent: false,
        message: 'Applied successfully (no change detection - old state not provided)'
      })
    }

    // Enrich old snapshot with interpreter details for accurate display
    const oldBooking = requestBody.oldBookingSnapshot as any

    // Fetch old interpreter details if empCode is provided
    if (oldBooking.interpreterEmpCode) {
      const oldInterpreter = await prisma.employee.findUnique({
        where: { empCode: oldBooking.interpreterEmpCode },
        select: {
          empCode: true,
          email: true,
          firstNameEn: true,
          lastNameEn: true,
        }
      })
      if (oldInterpreter) {
        oldBooking.interpreterEmployee = oldInterpreter
      }
    }

    // Detect changes between old and current state
    const changes = detectBookingChanges(oldBooking as BookingWithRelations, currentBooking)

    console.log(`[APPLY] Change detection for booking ${bookingId}:`, {
      hasInterpreterChange: changes.hasInterpreterChange,
      hasTimeChange: changes.hasTimeChange,
      hasRoomChange: changes.hasRoomChange,
      oldInterpreterCode: oldBooking.interpreterEmpCode,
      newInterpreterCode: currentBooking.interpreterEmpCode,
      oldTimeStart: oldBooking.timeStart,
      newTimeStart: currentBooking.timeStart,
      oldTimeEnd: oldBooking.timeEnd,
      newTimeEnd: currentBooking.timeEnd,
      oldRoom: oldBooking.meetingRoom,
      newRoom: currentBooking.meetingRoom
    })

    // Only send email if:
    // 1. Changes detected
    // 2. Booking is approved
    let emailSent = false
    let interpreterCancellationSent = false

    if (hasAnyChanges(changes) && currentBooking.bookingStatus === 'approve') {
      try {
        console.log(`[APPLY] Sending change notification email for booking ${bookingId}`)

        // Get formatted email template
        const { subject, body, isHtml } = await getFormattedChangeTemplateForBooking(
          bookingId,
          changes,
          currentBooking
        )

        // Build recipient list
        const recipients = new Set<string>()
        const ccRecipients = new Set<string>()

        // Add owner/booker
        if (currentBooking.employee?.email) {
          recipients.add(currentBooking.employee.email)
        }

        // Add NEW interpreter to CC (NOT the old one - they get a separate cancellation)
        if (currentBooking.interpreterEmployee?.email) {
          ccRecipients.add(currentBooking.interpreterEmployee.email)
        }

        // Add selected interpreter to CC (for President meetings)
        if (currentBooking.selectedInterpreter?.email) {
          ccRecipients.add(currentBooking.selectedInterpreter.email)
        }

        // Add chairman
        if (currentBooking.chairmanEmail) {
          recipients.add(currentBooking.chairmanEmail)
        }

        // Add all invited attendees
        currentBooking.inviteEmails?.forEach(invite => {
          if (invite.email) {
            recipients.add(invite.email)
          }
        })

        // Add admin emails to CC
        const adminEmails = await getAdminEmailsForBooking(bookingId)
        const recipientsLower = new Set(Array.from(recipients).map(e => e.toLowerCase()))
        const ccLower = new Set(Array.from(ccRecipients).map(e => e.toLowerCase()))

        adminEmails.forEach(adminEmail => {
          const lower = adminEmail.toLowerCase()
          if (!recipientsLower.has(lower) && !ccLower.has(lower)) {
            ccRecipients.add(adminEmail)
          }
        })

        // Deduplicate CC
        const deduplicatedCC = Array.from(ccRecipients).filter(
          cc => !recipientsLower.has(cc.toLowerCase())
        )

        console.log(`[APPLY] Email recipients - TO: ${recipients.size}, CC: ${deduplicatedCC.length}`)

        // Send email directly using sendChangeNotificationEmail
        const { sendChangeNotificationEmail, sendInterpreterReplacementNotification } = await import('@/lib/mail/sender')

        await sendChangeNotificationEmail(
          bookingId,
          Array.from(recipients),
          deduplicatedCC,
          subject,
          body,
          isHtml,
          currentBooking,
          changes
        )

        emailSent = true
        console.log(`[APPLY] Change notification email sent successfully for booking ${bookingId}`)
        console.log(`[APPLY] Change types: ${buildChangeTypesString(changes)}`)

        // If interpreter was changed, send cancellation ONLY to old interpreter
        if (changes.hasInterpreterChange && oldBooking.interpreterEmployee?.email) {
          try {
            console.log(`[APPLY] Interpreter changed - sending cancellation to old interpreter only`)

            await sendInterpreterReplacementNotification(
              bookingId,
              oldBooking.interpreterEmployee.email,
              changes.oldInterpreter || 'Previous Interpreter',
              changes.newInterpreter || 'New Interpreter'
            )

            interpreterCancellationSent = true
            console.log(`[APPLY] Interpreter cancellation sent to old interpreter: ${oldBooking.interpreterEmployee.email}`)
          } catch (error) {
            console.error(`[APPLY] Failed to send interpreter cancellation (non-critical):`, error)
            // Don't fail the whole operation if this fails
          }
        }

      } catch (error) {
        console.error(`[APPLY] Failed to send change notification email for booking ${bookingId}:`, error)
        // Don't fail the Apply action if email fails
        // Return success but indicate email failure
        return NextResponse.json({
          success: true,
          changesDetected: true,
          changes,
          emailSent: false,
          emailError: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      if (!hasAnyChanges(changes)) {
        console.log(`[APPLY] No changes detected for booking ${bookingId} - no email sent`)
      } else if (currentBooking.bookingStatus !== 'approve') {
        console.log(`[APPLY] Booking ${bookingId} is not approved (status: ${currentBooking.bookingStatus}) - no email sent`)
      }
    }

    return NextResponse.json({
      success: true,
      changesDetected: hasAnyChanges(changes),
      changes: hasAnyChanges(changes) ? {
        interpreter: changes.hasInterpreterChange ? {
          old: changes.oldInterpreter,
          new: changes.newInterpreter
        } : null,
        time: changes.hasTimeChange ? {
          old: changes.oldTime,
          new: changes.newTime
        } : null,
        room: changes.hasRoomChange ? {
          old: changes.oldRoom,
          new: changes.newRoom
        } : null
      } : null,
      emailSent,
      interpreterCancellationSent
    })

  } catch (error) {
    console.error('[APPLY] Error in apply endpoint:', error)
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unexpected error'
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/booking-data/[id]/apply
 * CORS preflight
 */
export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  res.headers.set('Allow', 'POST, OPTIONS')
  return res
}
