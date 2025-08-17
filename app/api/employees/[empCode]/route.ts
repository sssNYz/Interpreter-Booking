import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: { empCode: string } }
) {
  const empCode = (context.params.empCode || "").trim();
  if (!empCode) {
    return NextResponse.json({ error: "Missing empCode" }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      EMP_CODE: string | null;
      FIRST_NAME_EN: string | null;
      LAST_NAME_EN: string | null;
      FIRST_NAME_TH: string | null;
      LAST_NAME_TH: string | null;
      EMAIL: string | null;
      TEL_EXT: string | null;
    }>>(
      `SELECT EMP_CODE, FIRST_NAME_EN, LAST_NAME_EN, FIRST_NAME_TH, LAST_NAME_TH, EMAIL, TEL_EXT
       FROM EMPLOYEE WHERE EMP_CODE = ? LIMIT 1`,
      empCode
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const nameEn = `${row.FIRST_NAME_EN ?? ""} ${row.LAST_NAME_EN ?? ""}`.trim();
    const nameTh = `${row.FIRST_NAME_TH ?? ""} ${row.LAST_NAME_TH ?? ""}`.trim();
    const name = nameEn || nameTh || "";
    return NextResponse.json({
      empCode: row.EMP_CODE,
      name,
      email: row.EMAIL,
      tel: row.TEL_EXT,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


