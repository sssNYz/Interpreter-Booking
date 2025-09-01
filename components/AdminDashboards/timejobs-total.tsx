"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";

// ⬇️ Use your central types
import {
  MonthName,
  HoursRow,
  FooterByInterpreter,
  InterpreterName,
} from "@/types/overview";

type ApiResponse = {
  months: MonthName[];
  interpreters: InterpreterName[];
  totalHoursLineMinutes: HoursRow[]; // minutes per month + per interpreter
  hoursFooter: FooterByInterpreter;
  year: number;
};

/** เดิม: แสดงเป็น h.mm h (คงรูปแบบเดิมของคุณไว้) */
function formatHoursDecimal(mins: number): string {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}.${String(mm).padStart(2, "0")} h`;
}

/** ticks ทุก 2 ชั่วโมง: รับ max (นาที) คืนอาร์เรย์ของนาที [0, 120, 240, ...] */
function buildTwoHourTicks(maxMinutes: number): number[] {
  const topHours = Math.ceil((Math.max(0, maxMinutes) / 60) / 2) * 2; // ปัดขึ้น step 2 ชม.
  const out: number[] = [];
  for (let h = 0; h <= topHours; h += 2) out.push(h * 60);
  return out.length ? out : [0, 120]; // กันกรณีข้อมูลเป็นศูนย์
}

/** สี diff สำหรับตาราง (เหมือนเดิม) */
function diffClass(v: number): string {
  if (v >= 10) return "text-red-600";
  if (v >= 5) return "text-orange-600";
  if (v >= 2) return "text-amber-600";
  return "text-emerald-700";
}

export function HoursTab({ year }: { year: number }) {
  // Hooks (ลำดับต้องคงที่)
  const [data, setData] = React.useState<ApiResponse | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(`/api/admin-dashboard/timejobs-total/${year}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = (await r.json()) as ApiResponse;
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) console.error("Error fetching hours data:", e);
      });
    return () => {
      alive = false;
    };
  }, [year]);

  // Derivations (ใช้ค่า fallback เมื่อยังไม่มี data เพื่อไม่ให้ลำดับ hooks เปลี่ยน)
  const interpreters: InterpreterName[] = (data?.interpreters ?? []) as InterpreterName[];
  const rows: HoursRow[] = (data?.totalHoursLineMinutes ?? []) as HoursRow[];
  const footer: FooterByInterpreter | null = data?.hoursFooter ?? null;
  const theYear = data?.year ?? year;

  // หาเดือนปฏิทินปัจจุบันจาก data.months เพื่อทำ highlight ในตาราง
  const currentMonth = React.useMemo<MonthName | "">(() => {
    if (!data?.months?.length) return "";
    const idx = new Date().getMonth(); // 0=Jan ... 11=Dec
    return data.months[idx] ?? "";
  }, [data]);

  // สีของแต่ละล่าม
  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    const palette = [
      "#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED",
      "#0EA5E9", "#059669", "#CA8A04", "#EA580C", "#9333EA",
    ];
    const map = {} as Record<InterpreterName, string>;
    for (let i = 0; i < interpreters.length; i++) {
      const n = interpreters[i];
      map[n] = palette[i % palette.length] ?? "#94a3b8";
    }
    return map;
  }, [interpreters]);

  // ค่าสูงสุดของนาทีในชุดข้อมูล (เพื่อสร้าง domain/ticks)
  const maxMinutes = React.useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const p of interpreters) {
        const v = Number((row as any)[p] ?? 0);
        if (v > max) max = v;
      }
    }
    return max;
  }, [rows, interpreters]);

  // ticks ทุก 2 ชั่วโมง + domain เริ่ม 0 เสมอ
  const yTicks = React.useMemo(() => buildTwoHourTicks(maxMinutes), [maxMinutes]);
  const yDomain: [number, number] = [0, yTicks[yTicks.length - 1] ?? 0];

  // Render
  return (
    <>
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Total Time per Month (Year {theYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              {/* เริ่มที่ 0 และเพิ่มทีละ 2 ชั่วโมง; label เป็นชั่วโมงเต็ม */}
              <YAxis
                domain={yDomain}
                ticks={yTicks}
                tickFormatter={(v) => `${Number(v) / 60} h`}
                allowDecimals={false}
                width={56}
                tickMargin={6}
              />
              <Tooltip
                formatter={(value) => formatHoursDecimal(Number(value))}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              {interpreters.map((p) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={p}
                  fill={interpreterColors[p] ?? "#94a3b8"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Monthly Time Summary (displayed as hr/min) – Year {theYear} with Diff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left sticky left-0 z-10 bg-slate-100 dark:bg-slate-800">
                    Month
                  </th>

                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">{p}</th>
                  ))}
                  {/* ย้าย Diff มาก่อน Total ตามสไตล์ใหม่ */}
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const vals = interpreters.map((p) => Number((r as any)[p] ?? 0));
                  const maxV = vals.length ? Math.max(...vals) : 0;
                  const minV = vals.length ? Math.min(...vals) : 0;
                  const d = maxV - minV;
                  const isCurrent = r.month === currentMonth;

                  return (
                    <tr
                      key={r.month}
                      className={[
                        "border-b",
                        isCurrent
                          // แถวเดือนปัจจุบัน: ไฮไลต์ฟ้า และ hover แล้วยังคงสีเดิม
                          ? "bg-blue-100 dark:bg-blue-900/40 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
                          // แถวปกติ: zebra + hover เทาอ่อน
                          : "odd:bg-white even:bg-muted/30 hover:bg-muted/40",
                      ].join(" ").trim()}
                    >
                      {/* ใช้ bg-inherit ให้เซลล์ sticky รับสีพื้นจากแถว */}
                      <td className="p-2 sticky left-0 z-10 bg-inherit">{r.month}</td>

                      {interpreters.map((p) => (
                        <td key={p} className="p-2 text-right">
                          {formatHoursDecimal(Number((r as any)[p] ?? 0))}
                        </td>
                      ))}
                      {/* Diff ก่อน Total */}
                      <td className={`p-2 text-right font-medium ${diffClass(d)}`}>
                        {formatHoursDecimal(d)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatHoursDecimal((r as any).total ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                {/* TOTAL row (คงสีเขียว และ hover ไม่เปลี่ยนสี) */}
                <tr className="bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-50">
                  <td className="p-2">TOTAL</td>
                  {(footer?.perInterpreter ?? []).map((v, idx) => (
                    <td key={idx} className="p-2 text-right">
                      {formatHoursDecimal(v)}
                    </td>
                  ))}
                  <td className={`p-2 text-right ${diffClass(footer?.diff ?? 0)}`}>
                    {formatHoursDecimal(footer?.diff ?? 0)}
                  </td>
                  <td className="p-2 text-right">
                    {formatHoursDecimal(footer?.grand ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
