import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";

// app/api/interpreters/count/route.ts
export async function GET() {
    try {
      const interpreterCount = await prisma.employee.count({
        where: {
          userRoles: {
            some: {
              roleCode: 'INTERPRETER'  // or whatever role code interpreters have
            }
          }
        }
      });
      
      return NextResponse.json({ count: interpreterCount });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to count interpreters' }, { status: 500 });
    }
  }