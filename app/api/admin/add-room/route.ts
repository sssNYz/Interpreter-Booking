import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * POST /api/admin/room-management - Add a new room
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, location, capacity, isActive = true } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Room name is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    // Validate capacity
    if (
      capacity !== undefined &&
      (typeof capacity !== "number" || capacity < 1)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Capacity must be a positive number",
        },
        { status: 400 }
      );
    }

    // Check if room name already exists
    const existingRoom = await prisma.room.findFirst({
      where: { name: name.trim() },
    });

    if (existingRoom) {
      return NextResponse.json(
        {
          success: false,
          error: "Room with this name already exists",
        },
        { status: 409 }
      );
    }

    // Create new room
    const newRoom = await prisma.room.create({
      data: {
        name: name.trim(),
        location: location?.trim() || null,
        capacity: capacity || 1,
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Room created successfully",
        data: newRoom,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create room",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/room-management - Get all rooms with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    // Build where clause
    const where: any = {};

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count and rooms
    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        rooms,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rooms",
      },
      { status: 500 }
    );
  }
}
