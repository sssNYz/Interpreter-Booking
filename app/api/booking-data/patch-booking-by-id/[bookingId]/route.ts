import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { z } from "zod";
// ---- Schema ของ body (ให้ตรง enum ใน Prisma) ----
const PatchSchema = z.object({
  bookingStatus: z.enum(["approve", "cancel", "waiting"]).optional(),
  // Support room updates (use database field name 'meetingRoom')
  room: z.string().min(1).optional(),
  // Support participant email updates
  inviteEmails: z.array(z.string().email()).optional(),
  // ถ้าต้องแก้ไขล่ามพร้อมกันให้เปิดใช้:
  // interpreterEmpCode: z.string().min(1).optional(),
});
// ---- กติกาการเปลี่ยนสถานะ (ปรับได้ตามธุรกิจ) ----
type Status = "waiting" | "approve" | "cancel";
const allowedTransitions: Record<Status, Status[]> = {
  waiting: ["waiting", "approve", "cancel"],
  approve: ["approve", "cancel"], // ไม่ย้อนกลับ waiting
  cancel:  ["cancel"],            // ยกเลิกแล้วไม่ให้กลับ
};
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  // 1) ตรวจ path param
  const resolvedParams = await params;
  const bookingId = Number(resolvedParams.bookingId);
  if (!Number.isFinite(bookingId)) {
    return problem(400, "Invalid bookingId", "bookingId must be an integer.");
  }
  // 2) อ่านและตรวจ body
  let parsed: z.infer<typeof PatchSchema>;
  try {
    const json = await req.json();
    const result = PatchSchema.safeParse(json);
    if (!result.success) {
      return problem(422, "Invalid request body", "Body does not match schema.");
    }
    parsed = result.data;
  } catch {
    return problem(400, "Invalid JSON", "Request body must be valid JSON.");
  }
  // 3) หา record เดิม (with interpreter info for cancellation email)
  const existing = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: {
      bookingStatus: true,
      interpreterEmpCode: true,
      selectedInterpreterEmpCode: true,
      interpreterEmployee: {
        select: {
          empCode: true,
          email: true,
          firstNameEn: true,
          lastNameEn: true,
        }
      },
      selectedInterpreter: {
        select: {
          empCode: true,
          email: true,
          firstNameEn: true,
          lastNameEn: true,
        }
      },
    },
  });
  if (!existing) {
    return problem(404, "Not Found", "Booking plan not found.");
  }
  // 4) Prepare update data
  const updateData: any = {};

  // Track status changes for email logic
  let statusFrom: Status | null = null;
  let statusTo: Status | null = null;

  // Handle status change if provided
  if (parsed.bookingStatus) {
    statusFrom = existing.bookingStatus as Status;
    statusTo = parsed.bookingStatus as Status;
    if (!allowedTransitions[statusFrom]?.includes(statusTo)) {
      return problem(409, "Conflict", `Cannot transition from '${statusFrom}' to '${statusTo}'.`);
    }
    updateData.bookingStatus = parsed.bookingStatus;
  }

  // Handle room change if provided
  if (parsed.room) {
    updateData.meetingRoom = parsed.room;
    console.log(`[PATCH] Updating room for booking ${bookingId}: ${existing.bookingStatus} -> ${parsed.room}`);
  }

  // Handle participant email updates if provided
  let inviteEmailsToUpdate: string[] | null = null;
  if (parsed.inviteEmails !== undefined) {
    inviteEmailsToUpdate = parsed.inviteEmails;
    console.log(`[PATCH] Updating participants for booking ${bookingId}:`, inviteEmailsToUpdate);
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0 && inviteEmailsToUpdate === null) {
    return problem(400, "Bad Request", "No fields to update provided");
  }

  // 5) อัปเดต
  // Handle inviteEmails separately using transaction if needed
  let updated;
  if (inviteEmailsToUpdate !== null) {
    // Use transaction to update both booking and inviteEmails
    updated = await prisma.$transaction(async (tx) => {
      // First, delete existing invite emails
      await tx.inviteEmailList.deleteMany({
        where: { bookingId },
      });

      // Then, create new invite emails
      if (inviteEmailsToUpdate.length > 0) {
        await tx.inviteEmailList.createMany({
          data: inviteEmailsToUpdate.map((email) => ({
            bookingId,
            email,
          })),
        });
      }

      // Finally, update the booking plan
      return await tx.bookingPlan.update({
        where: { bookingId },
        data: updateData,
        include: {
          employee: true,
          interpreterEmployee: true,
          inviteEmails: true,
        },
      });
    });
  } else {
    // No inviteEmails update, just update the booking
    updated = await prisma.bookingPlan.update({
      where: { bookingId },
      data: updateData,
      include: {
        employee: true,
        interpreterEmployee: true,
        inviteEmails: true,
      },
    });
  }
  // ⚠️ EMAIL TRIGGER - Modified to prevent duplicate emails
  // Only send emails on FIRST approval or cancellation (not on updates)
  // For updates to already-approved bookings, use the unified Apply endpoint
  // Room changes should use the unified Apply endpoint
  // See EMAIL_CONSOLIDATION_PLAN.md for details
  try {
    if (statusFrom && statusTo && ((statusTo === 'approve' && statusFrom !== 'approve') || (statusTo === 'cancel' && statusFrom !== 'cancel'))) {
      const { sendApprovalEmailForBooking, sendCancellationEmailForBooking } = await import('@/lib/mail/sender')

      // FIRST APPROVAL: waiting → approve (send initial invitation)
      if (statusTo === 'approve' && statusFrom === 'waiting') {
        console.log(`[EMAIL] Triggering INITIAL approval email for booking ${updated.bookingId} (first approval)`)
        sendApprovalEmailForBooking(updated.bookingId).catch((err) => {
          console.error(`[EMAIL] Failed to send approval email for booking ${updated.bookingId}:`, err)
        })
      }
      // UPDATES TO APPROVED BOOKINGS: Should use unified Apply endpoint instead
      else if (statusTo === 'approve' && statusFrom === 'approve') {
        console.log(`[EMAIL] Booking ${updated.bookingId} is already approved - no email sent`)
        console.log(`[EMAIL] For updates to approved bookings, use the unified Apply endpoint`)
      }

      // CANCELLATION: any status → cancel (send cancellation)
      if (statusTo === 'cancel' && statusFrom !== 'cancel') {
        console.log(`[EMAIL] Triggering cancellation email for booking ${updated.bookingId}`)
        // Pass preserved interpreter info from 'existing' before it was cleared
        const preservedInfo = {
          interpreterEmpCode: existing.interpreterEmpCode,
          selectedInterpreterEmpCode: existing.selectedInterpreterEmpCode,
          interpreterEmployee: existing.interpreterEmployee,
          selectedInterpreter: existing.selectedInterpreter,
        }
        sendCancellationEmailForBooking(updated.bookingId, undefined, preservedInfo).catch((err) => {
          console.error(`[EMAIL] Failed to send cancellation email for booking ${updated.bookingId}:`, err)
        })
      }
    }

    // Log room changes (email will be sent via unified Apply endpoint)
    if (parsed.room) {
      console.log(`[EMAIL] Room updated for booking ${updated.bookingId}`)
      console.log(`[EMAIL] Email notification will be sent via unified Apply endpoint`)
    }
  } catch (err) {
    console.error('[EMAIL] Error in email trigger block:', err)
  }
  return NextResponse.json(updated, { status: 200 });
}
// (ทางเลือก) เปิดเผยเมธอดที่รองรับ
export function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Allow", "PATCH, OPTIONS");
  return res;
}
// ---------- helper: Problem Details (RFC 7807) ----------
function problem(status: number, title: string, detail?: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}