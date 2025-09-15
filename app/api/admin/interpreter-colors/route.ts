import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const COLORS_PATH = path.join(process.cwd(), "config", "interpreter-colors.json");

async function readColors(): Promise<Record<string, string>> {
  try {
    const data = await fs.readFile(COLORS_PATH, "utf-8");
    return JSON.parse(data) as Record<string, string>;
  } catch (e: unknown) {
    // If file missing, start with empty map
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

async function writeColors(colors: Record<string, string>): Promise<void> {
  const json = JSON.stringify(colors, null, 2);
  await fs.mkdir(path.dirname(COLORS_PATH), { recursive: true });
  await fs.writeFile(COLORS_PATH, json, "utf-8");
}

export async function GET() {
  try {
    const colors = await readColors();
    return NextResponse.json({ success: true, data: colors });
  } catch (error) {
    console.error("Failed to read interpreter colors:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      interpreterId: string;
      color: string;
    } | {
      updates: Array<{ interpreterId: string; color: string | null }>;
    };

    const colors = await readColors();

    if ("interpreterId" in body && "color" in body) {
      const { interpreterId, color } = body;
      if (!interpreterId || typeof interpreterId !== "string") {
        return NextResponse.json(
          { success: false, error: "INVALID_INTERPRETER_ID" },
          { status: 400 }
        );
      }
      if (!color || typeof color !== "string") {
        return NextResponse.json(
          { success: false, error: "INVALID_COLOR" },
          { status: 400 }
        );
      }
      colors[interpreterId] = color;
    } else if ("updates" in body && Array.isArray(body.updates)) {
      for (const u of body.updates) {
        if (!u.interpreterId || typeof u.interpreterId !== "string") continue;
        if (u.color === null) {
          // allow clearing if needed
          delete colors[u.interpreterId];
        } else if (typeof u.color === "string") {
          colors[u.interpreterId] = u.color;
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    await writeColors(colors);
    return NextResponse.json({ success: true, data: colors });
  } catch (error) {
    console.error("Failed to update interpreter colors:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}


