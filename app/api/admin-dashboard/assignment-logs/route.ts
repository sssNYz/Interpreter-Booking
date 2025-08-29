import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters with defaults
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100); // Max 100 per page
    const status = searchParams.get("status");
    const interpreterEmpCode = searchParams.get("interpreterEmpCode");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const sort = searchParams.get("sort") || "createdAt:desc";
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Build where conditions for filtering - ONLY add conditions when parameters are provided
    const whereConditions: Prisma.AssignmentLogWhereInput = {};
    
    // Only add filters when parameters are actually provided (not empty strings)
    if (status && status !== "all" && status.trim()) {
      whereConditions.status = status.trim();
    }
    
    if (interpreterEmpCode && interpreterEmpCode.trim()) {
      whereConditions.interpreterEmpCode = interpreterEmpCode.trim();
    }
    
    // Date filtering - only when both dates are provided for better performance
    if (from && to && from.trim() && to.trim()) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        whereConditions.createdAt = {
          gte: fromDate,
          lte: toDate
        };
      }
    }
    
    // Search conditions - only when search term is meaningful
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim();
      // Check if search is a number (booking ID)
      const bookingId = parseInt(searchTerm);
      if (!isNaN(bookingId)) {
        whereConditions.bookingId = bookingId;
      } else {
        // Text search in reason field only
        whereConditions.reason = { contains: searchTerm };
      }
    }
    
    // Parse sort parameter with validation
    const [sortField, sortOrder] = sort.split(":");
    const orderBy: Prisma.AssignmentLogOrderByWithRelationInput = {};
    
    if (sortField === "createdAt") {
      orderBy.createdAt = sortOrder === "asc" ? "asc" : "desc";
    } else if (sortField === "bookingId") {
      orderBy.bookingId = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc"; // Default sort
    }
    
    // Execute optimized queries with database-level filtering
    const [logs, total] = await Promise.all([
      // Get paginated logs with minimal includes - only fetch what's needed
      prisma.assignmentLog.findMany({
        where: whereConditions,
        select: {
          id: true,
          bookingId: true,
          interpreterEmpCode: true,
          status: true,
          reason: true,
          createdAt: true,
          preHoursSnapshot: true,
          postHoursSnapshot: true,
          scoreBreakdown: true,
          // Only include booking plan fields that are actually displayed
          bookingPlan: {
            select: {
              meetingType: true,
              ownerGroup: true,
              timeStart: true,
              timeEnd: true,
              meetingRoom: true,
              drType: true,
              otherType: true
            }
          },
          // Only include interpreter fields that are actually displayed
          interpreterEmployee: {
            select: {
              empCode: true,
              firstNameEn: true,
              lastNameEn: true,
              firstNameTh: true,
              lastNameTh: true
            }
          }
        },
        orderBy: orderBy,
        skip: offset,
        take: pageSize,
      }),
      
      // Get total count for pagination - only when filters are applied
      prisma.assignmentLog.count({
        where: whereConditions
      })
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / pageSize);
    
    // Get summary statistics - only when there are active filters
    const summaryByInterpreter: Record<string, { assigned: number; approved: number; rejected: number }> = {};
    
    if (Object.keys(whereConditions).length > 0) {
      const summary = await prisma.assignmentLog.groupBy({
        by: ["interpreterEmpCode", "status"],
        where: whereConditions,
        _count: {
          status: true
        }
      });
      
      // Process summary data
      summary.forEach((item: { interpreterEmpCode: string | null; status: string; _count: { status: number } }) => {
        if (item.interpreterEmpCode) {
          if (!summaryByInterpreter[item.interpreterEmpCode]) {
            summaryByInterpreter[item.interpreterEmpCode] = { assigned: 0, approved: 0, rejected: 0 };
          }
          
          if (item.status === "assigned") {
            summaryByInterpreter[item.interpreterEmpCode].assigned = item._count.status;
          } else if (item.status === "approved") {
            summaryByInterpreter[item.interpreterEmpCode].approved = item._count.status;
          } else if (item.status === "rejected") {
            summaryByInterpreter[item.interpreterEmpCode].rejected = item._count.status;
          }
        }
      });
    }
    
    // Transform logs data efficiently
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      bookingId: log.bookingId,
      interpreterEmpCode: log.interpreterEmpCode,
      status: log.status,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
      preHoursSnapshot: log.preHoursSnapshot,
      postHoursSnapshot: log.postHoursSnapshot,
      scoreBreakdown: log.scoreBreakdown,
      bookingPlan: {
        meetingType: log.bookingPlan.meetingType,
        ownerGroup: log.bookingPlan.ownerGroup,
        timeStart: log.bookingPlan.timeStart.toISOString(),
        timeEnd: log.bookingPlan.timeEnd.toISOString(),
        meetingRoom: log.bookingPlan.meetingRoom,
        drType: log.bookingPlan.drType,
        otherType: log.bookingPlan.otherType
      },
      interpreterEmployee: log.interpreterEmployee ? {
        empCode: log.interpreterEmployee.empCode,
        firstNameEn: log.interpreterEmployee.firstNameEn,
        lastNameEn: log.interpreterEmployee.lastNameEn,
        firstNameTh: log.interpreterEmployee.firstNameTh,
        lastNameTh: log.interpreterEmployee.lastNameTh
      } : null
    }));
    
    // Create response with performance headers
    const jsonResponse = NextResponse.json({
      items: transformedLogs,
      total,
      page,
      pageSize,
      totalPages,
      summary: {
        byInterpreter: summaryByInterpreter
      }
    });
    
    // Add performance headers
    jsonResponse.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    jsonResponse.headers.set('X-Total-Count', total.toString());
    jsonResponse.headers.set('X-Page-Count', totalPages.toString());
    
    return jsonResponse;
    
  } catch (error) {
    console.error("Error fetching assignment logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment logs" },
      { status: 500 }
    );
  }
}
