import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * GET /api/admin/room-management/[id] - Get room by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = parseInt(params.id);

    if (isNaN(roomId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room ID",
        },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        bookings: {
          select: {
            bookingId: true,
            timeStart: true,
            timeEnd: true,
            bookingStatus: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch room",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/room-management/[id] - Update room by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = parseInt(params.id);
    const body = await request.json();
    const { name, location, capacity, isActive } = body;

    if (isNaN(roomId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room ID",
        },
        { status: 400 }
      );
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!existingRoom) {
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
        },
        { status: 404 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Room name must be a non-empty string",
          },
          { status: 400 }
        );
      }

      // Check if name already exists (excluding current room)
      const nameExists = await prisma.room.findFirst({
        where: {
          name: name.trim(),
          id: { not: roomId },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          {
            success: false,
            error: "Room with this name already exists",
          },
          { status: 409 }
        );
      }
    }

    // Validate capacity if provided
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

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Room updated successfully",
      data: updatedRoom,
    });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update room",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/room-management/[id] - Delete room by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = parseInt(params.id);

    if (isNaN(roomId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid room ID",
        },
        { status: 400 }
      );
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        bookings: {
          where: {
            bookingStatus: {
              in: ["approve", "waiting"],
            },
          },
        },
      },
    });

    if (!existingRoom) {
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
        },
        { status: 404 }
      );
    }

    // Check if room has active bookings
    if (existingRoom.bookings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete room with active bookings. Please cancel or complete all bookings first.",
        },
        { status: 409 }
      );
    }

    // Delete room
    await prisma.room.delete({
      where: { id: roomId },
    });

    return NextResponse.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete room",
      },
      { status: 500 }
    );
  }
}
