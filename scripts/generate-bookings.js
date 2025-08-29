// Minimal Node script to login, switch auto-assignment mode, and create bookings
// Usage: node scripts/generate-bookings.js MODE YEAR MONTH
// Example: node scripts/generate-bookings.js NORMAL 2026 1

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function login(empCode, password) {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empCode, oldPassword: password })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Login failed: ${res.status} ${txt}`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No session cookie returned by login");
  // Extract cookie name=value; keep attributes out
  const cookie = setCookie.split(",")[0].split(";")[0];
  return cookie;
}

async function setMode(cookie, mode) {
  const res = await fetch(`${BASE_URL}/api/admin/config/auto-assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({ policy: { mode: String(mode).toUpperCase() } })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Set mode failed: ${res.status} ${txt}`);
  }
}

function formatDateYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function* workdaysInMonth(year, monthIndexZeroBased) {
  const d = new Date(year, monthIndexZeroBased, 1);
  while (d.getMonth() === monthIndexZeroBased) {
    const day = d.getDay(); // 0=Sun .. 6=Sat
    if (day !== 0 && day !== 6) {
      yield new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
}

async function createBooking(cookie, payload) {
  const res = await fetch(`${BASE_URL}/api/booking-data/post-booking-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify(payload)
  });
  if (res.status === 409) {
    // Try force once if overlap warning
    let json;
    try { json = await res.json(); } catch { json = {}; }
    if (json?.code === "OVERLAP_WARNING" || json?.error === "Overlap warning") {
      const res2 = await fetch(`${BASE_URL}/api/booking-data/post-booking-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie
        },
        body: JSON.stringify({ ...payload, force: true })
      });
      if (!res2.ok) {
        const t2 = await res2.text().catch(() => "");
        throw new Error(`Create booking (forced) failed: ${res2.status} ${t2}`);
      }
      return res2.json();
    }
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Create booking failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function main() {
  const mode = (process.argv[2] || "NORMAL").toUpperCase();
  const year = Number(process.argv[3] || 2026);
  const month = Number(process.argv[4] || 1); // 1..12
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error("Invalid YEAR or MONTH. Usage: node scripts/generate-bookings.js MODE YEAR MONTH");
  }

  const empCode = process.env.TEST_EMP_CODE || "83931";
  const password = process.env.TEST_PASSWORD || "83931Ogk";

  console.log(`Logging in as ${empCode} ...`);
  const cookie = await login(empCode, password);
  console.log(`Switching auto-assign mode to ${mode} ...`);
  await setMode(cookie, mode);

  const maxCount = 20;
  let created = 0;
  const monthIdx = month - 1;
  console.log(`Creating up to ${maxCount} bookings for ${year}-${String(month).padStart(2, "0")} (weekdays only) ...`);
  for (const d of workdaysInMonth(year, monthIdx)) {
    if (created >= maxCount) break;
    const ymd = formatDateYmd(d);
    const timeStart = `${ymd} 08:00:00`;
    const timeEnd = `${ymd} 17:00:00`;
    const payload = {
      ownerEmpCode: empCode,
      ownerGroup: "software",
      meetingRoom: "R1",
      meetingType: "General",
      meetingDetail: `Test booking ${mode} ${ymd}`,
      applicableModel: null,
      timeStart,
      timeEnd,
      interpreterEmpCode: null,
      bookingStatus: "waiting",
      inviteEmails: [],
      isRecurring: false
    };
    try {
      const res = await createBooking(cookie, payload);
      const id = res?.data?.bookingId ?? "?";
      console.log(`Created booking #${id} ${timeStart}→${timeEnd}`);
      created += 1;
    } catch (err) {
      console.warn(`Skip ${ymd}: ${(err && err.message) || err}`);
    }
    // brief pacing to be nice to DB
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Done. Created ${created} bookings in ${mode} mode.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


