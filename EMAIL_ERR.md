## Email Error Log Snapshot and Analysis

This document records the error you showed in the screenshot and provides a detailed analysis of what is happening in the code during send.

### 1) Captured console output (transcribed from screenshot)

```text
note: 'Assigned using CUSTOM mode with conflict detection'

[EMAIL] Added assigned interpreter to CC: pacharapol@dit.daikin.co.jp
[EMAIL] Adding 1 admin emails to CC: [ 'pacharapol@dit.daikin.co.jp' ]
[EMAIL] Sending approval email for booking 55 to 2 recipients: [ 'pacharapol@dit.daikin.co.jp', 'thumathan@dit.daikin.co.jp' ]
[EMAIL] CC: 0 recipients: []
[EMAIL] Verifying SMTP connection for approval email...

✓ Flushed 1 assignment logs successfully
✓ Flushed 1 conflict logs successfully
✓ All log buffers flushed successfully
ℹ Performance Monitor: Avg processing: 13ms, Conflict rate: 0.0%, Load: LOW
✓ All log buffers flushed successfully

[EMAIL] CRITICAL ERROR sending approval email for booking 54: Error: Connection timeout
    at m._formatError (.next/server/chunks/5112.js:1:62003)
    at m._onError     (.next/server/chunks/5112.js:1:61831)
    at Timeout.<anonymous> (.next/server/chunks/5112.js:1:53809) {
      code: 'ETIMEDOUT',
      command: 'CONN'
    }
```

Notes:
- Email addresses above are transcribed as shown; line wrapping in the terminal may slightly affect spacing.
- Booking id appears as 55 in the "Sending approval" line but 54 in the error line (see “Mismatches” below).

### 2) Structured details extracted from the log

- **Action**: Send approval email
- **Recipients (To)**: `['pacharapol@dit.daikin.co.jp', 'thumathan@dit.daikin.co.jp']`
- **Recipients (CC)**: `[]`
- **Added CC before send**: interpreter address + 1 admin address (deduped to none in final CC)
- **Pre-send step**: "Verifying SMTP connection for approval email..."
- **Outcome**: Critical error during connection verification
- **Error**: `Connection timeout`
- **Error.code**: `ETIMEDOUT`
- **Error.command**: `CONN` (Nodemailer indicates failure establishing TCP connection)
- **Stack excerpts**: from compiled Next server chunks `5112.js` at offsets 62003, 61831, 53809
- **Ancillary logs**: assignment/conflict logs flushed successfully; performance monitor indicates low load
- **Mismatches**: Log says "Sending ... booking 55" but error reports "booking 54" (likely a race or reused logger context; see analysis)

### 3) Where the failure happens in code

The error is thrown while verifying the SMTP connection in the mail sender. The relevant code is:

```8:25:lib/mail/sender.ts
function createTransporter() {
  const host = (process.env.SMTP_HOST ?? '').trim() || '192.168.212.220'
  const port = parseInt(process.env.SMTP_PORT ?? '25', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const authMethod = (process.env.SMTP_AUTH_METHOD ?? 'none').toLowerCase()
  const auth = authMethod === 'none'
    ? undefined
    : {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    tls: { rejectUnauthorized: false }
  })
}
```

```199:204:lib/mail/sender.ts
  try {
    console.log(`[EMAIL] Verifying SMTP connection for approval email...`)
    await transporter.verify()
    console.log(`[EMAIL] SMTP connection verified successfully`)
```

Observations:
- `verify()` is called just before composing and sending the email; your log shows the pre-verify message but never the success message, then errors with `ETIMEDOUT` and `command: 'CONN'`.
- The default host is `192.168.212.220` on port `25` when `SMTP_HOST`/`SMTP_PORT` are not set.

### 4) Analysis of the error log

- **What the error string tells us**: `ETIMEDOUT` with `command: 'CONN'` comes from Nodemailer when it cannot open a TCP connection to the SMTP server within its timeout. This occurs before authentication or TLS handshake.
- **Sequence in your log**:
  1) Recipients determined and CC deduplicated.
  2) "Verifying SMTP connection..." logged.
  3) Immediately after, other subsystems finish flushing logs and print performance metrics (unrelated to mail).
  4) Mail path throws `ETIMEDOUT`.
- **Booking id mismatch (55 vs 54)**: suggests multiple approval sends were in flight or a prior booking’s error surfaced later; since both use the same shared logger tag `[EMAIL]`, different async calls can interleave. This does not change the root of the error (connection timeout during SMTP verify).
- **Impact**: The approval email is not sent; nothing proceeds past connection verification.

### 5) Context on configuration (for reference)

The transporter defaults to an internal SMTP on `192.168.212.220:25` unless overridden by env vars. Additional code that triggers approval sends:

```184:194:app/api/admin/bookings/[id]/approve/route.ts
    if (result.status === 200) {
      try {
        console.log(`[ADMIN_APPROVE] Triggering approval email for booking ${bookingId}`)
        const { sendApprovalEmailForBooking } = await import('@/lib/mail/sender')
        sendApprovalEmailForBooking(bookingId).catch((err) => {
          console.error(`[ADMIN_APPROVE] Failed to send approval email for booking ${bookingId}:`, err)
        })
      } catch (err) {
        console.error('[ADMIN_APPROVE] Error in email trigger block:', err)
      }
    }
```

There is also a diagnostics route that performs an SMTP `verify()` check:

```375:389:app/api/mail/send-mail/route.ts
export async function GET() {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    return NextResponse.json({
      success: true,
      message: 'SMTP connection verified successfully',
      config: {
        host: process.env.SMTP_HOST || '192.168.212.220',
        port: process.env.SMTP_PORT || '25',
        secure: process.env.SMTP_SECURE || 'false',
        auth: process.env.SMTP_AUTH_METHOD || 'none',
        from: process.env.SMTP_FROM_EMAIL || 'DEDE_SYSTEM@dit.daikin.co.jp',
      },
    })
  } catch (error) {
    // ... returns { success: false, error: message }
  }
}
```

### 6) Key facts captured from the error

- Logged failure point: SMTP connection verification
- Error: `Connection timeout` (Nodemailer `ETIMEDOUT`, command `CONN`)
- Server/port used by default: `192.168.212.220:25`
- No evidence of SMTP auth/TLS errors (connection fails before those steps)
- Other subsystems (assignment logging, performance monitor) completed normally
- Potential concurrency: booking id mismatch indicates interleaved async logs

---

This file preserves the exact error text and shows the relevant code locations for fast triage.


