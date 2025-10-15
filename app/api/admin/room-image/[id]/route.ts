import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roomId = parseInt(id, 10);
    if (!Number.isFinite(roomId)) {
      return NextResponse.json(
        { success: false, error: "Invalid room ID" },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]; 
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: "File too large (max 5MB)" },
        { status: 413 }
      );
    }

    // Get room name for naming, fall back if missing
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    const baseName = slugify(room?.name || `room-${roomId}`);

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Resize and convert to JPEG for broad compatibility
    const processed = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const ts = Date.now();
    const uniqueFileName = `${baseName}_${roomId}_${ts}.jpg`;
    const aliasFileName = `${roomId}.jpg`; // used by BookingRoom view

    const dir = path.join(process.cwd(), "public", "Room");
    await fs.mkdir(dir, { recursive: true });

    // Save unique version and alias
    await fs.writeFile(path.join(dir, uniqueFileName), processed);
    await fs.writeFile(path.join(dir, aliasFileName), processed);

    return NextResponse.json({
      success: true,
      message: "Image uploaded",
      data: {
        url: `/Room/${aliasFileName}`,
        uniqueUrl: `/Room/${uniqueFileName}`,
      },
    });
  } catch (error) {
    console.error("Error uploading room image:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

