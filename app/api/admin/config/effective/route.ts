import { NextRequest, NextResponse } from "next/server";
import { getEffectivePolicyForEnvironment, getEnvMeetingTypePriority, getEnvModeThreshold } from "@/lib/assignment/config/env-policy";
import { getModeDefaults, loadPolicy } from "@/lib/assignment/config/policy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const envId = Number(searchParams.get('envId'));
  const meetingType = String(searchParams.get('type') || 'General');
  const modeParam = searchParams.get('mode');

  if (!Number.isFinite(envId)) return NextResponse.json({ ok: false, error: 'Missing envId' }, { status: 400 });

  const global = await loadPolicy();
  const mode = modeParam || global.mode;

  const [policy, priority, thresholds] = await Promise.all([
    getEffectivePolicyForEnvironment(envId),
    getEnvMeetingTypePriority(envId, meetingType),
    getEnvModeThreshold(envId, meetingType, mode)
  ]);

  return NextResponse.json({ ok: true, data: { policy, meetingType, priority, thresholds, mode } });
}

