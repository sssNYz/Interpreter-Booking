import { NextRequest, NextResponse } from 'next/server'
import { getInviteMeta } from '@/lib/mail/calendar-store'

// GET /api/calendar-store?uid=...
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const uid = url.searchParams.get('uid') || ''
    if (!uid) {
      return NextResponse.json({ success: false, error: 'uid is required' }, { status: 400 })
    }

    const meta = getInviteMeta(uid)
    if (!meta) {
      return NextResponse.json({ success: true, exists: false })
    }

    // Do not return raw ICS by default
    const { ics, ...safeMeta } = meta as Record<string, unknown>
    return NextResponse.json({ success: true, exists: true, meta: safeMeta, hasIcs: !!ics })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}


