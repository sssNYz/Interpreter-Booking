import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { z } from "zod";
// ---- Schema ของ body (ให้ตรง enum ใน Prisma) ----
const PatchSchema = z.object({
  bookingStatus: z.enum(["approve", "cancel", "waiting"]),
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
  { params }: { params: { bookingId: string } }
) {
  // 1) ตรวจ path param
  const bookingId = Number(params.bookingId);
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
  // 3) หา record เดิม
  const existing = await prisma.bookingPlan.findUnique({
    where: { bookingId },
    select: { bookingStatus: true },
  });
  if (!existing) {
    return problem(404, "Not Found", "Booking plan not found.");
  }
  // 4) ตรวจ transition
  const from = existing.bookingStatus as Status;
  const to = parsed.bookingStatus as Status;
  if (!allowedTransitions[from]?.includes(to)) {
    return problem(409, "Conflict", `Cannot transition from '${from}' to '${to}'.`);
  }
  // 5) อัปเดต
  const updated = await prisma.bookingPlan.update({
    where: { bookingId },
    data: {
      bookingStatus: parsed.bookingStatus,
      // interpreterEmpCode: parsed.interpreterEmpCode ?? undefined,
    },
    include: {
      employee: true,
      interpreterEmployee: true,
      inviteEmails: true,
    },
  });
  // fire-and-forget notifications when status transitions
  try {
    if ((to === 'approve' && from !== 'approve') || (to === 'cancel' && from !== 'cancel')) {
      const { sendApprovalEmailForBooking, sendCancellationEmailForBooking } = await import('@/lib/mail/sender')
      if (to === 'approve' && from !== 'approve') {
        console.log(`[EMAIL] Triggering approval email for booking ${updated.bookingId}`)
        sendApprovalEmailForBooking(updated.bookingId).catch((err) => {
          console.error(`[EMAIL] Failed to send approval email for booking ${updated.bookingId}:`, err)
        })
      }
      if (to === 'cancel' && from !== 'cancel') {
        console.log(`[EMAIL] Triggering cancellation email for booking ${updated.bookingId}`)
        sendCancellationEmailForBooking(updated.bookingId).catch((err) => {
          console.error(`[EMAIL] Failed to send cancellation email for booking ${updated.bookingId}:`, err)
        })
      }
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