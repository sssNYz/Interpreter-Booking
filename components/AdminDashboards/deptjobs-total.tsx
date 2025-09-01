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
import type {
  MonthName,
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
} from "@/types/overview";
import { OwnerGroupLabel as OGLabel } from "@/types/overview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/* ---------------------- Types for API response ---------------------- */
type DeptApiResponse = {
  months: MonthName[];
  interpreters: InterpreterName[];
  departments: OwnerGroup[];
  year: number;
  yearData: MonthlyDataRow[];
  deptMGIFooter: FooterByInterpreter;
};

/* ---------------------- Helpers ---------------------- */

type SingleMonthDeptBar = { group: string } & Record<InterpreterName, number>;

/** ✅ ใช้เดือนปฏิทินปัจจุบัน (ไม่เลื่อนแบบ fiscal) */
function getCurrentCalendarMonth(months: MonthName[]): MonthName {
  const cur = new Date().toLocaleString("en-US", { month: "short" }) as MonthName; // "Aug"
  return months.includes(cur) ? cur : (months[0] as MonthName);
}

function diffRange(values: number[]): number {
  if (!values.length) return 0;
  let min = values[0], max = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

function diffClass(v: number): string {
  if (v >= 10) return "text-red-600";
  if (v >= 5) return "text-orange-600";
  if (v >= 2) return "text-amber-600";
  return "text-emerald-700";
}

/* ---------------------- Component ---------------------- */

export function DeptTab({ year }: { year: number }) {
  // hooks ต้องอยู่บนสุด
  const [data, setData] = React.useState<DeptApiResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = React.useState<MonthName | "">("");
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);

  React.useEffect(() => {
    let alive = true;

    fetch(`/api/admin-dashboard/dept-total/${year}`, { 
      cache: "no-store"
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = (await r.json()) as DeptApiResponse;
        if (alive) {
          setData(j);
          // ✅ ตั้งค่าเริ่มต้นเป็น "เดือนปฏิทินปัจจุบัน"
          setSelectedMonth((prev) => (prev ? prev : getCurrentCalendarMonth(j.months)));
        }
      })
      .catch((e) => {
        if (alive) console.error("Error fetching dept data:", e);
      });

    return () => { alive = false; };
  }, [year]);

  // safe defaults ให้ hooks ด้านล่างรันทุกครั้ง
  const activeYear = data?.year ?? year;
  const months: MonthName[] = data?.months ?? [];
  const interpreters: InterpreterName[] = data?.interpreters ?? [];
  const departments: OwnerGroup[] = data?.departments ?? [];
  const yearData: MonthlyDataRow[] = data?.yearData ?? [];
  const deptMGIFooter: FooterByInterpreter =
    data?.deptMGIFooter ?? { perInterpreter: [], grand: 0, diff: 0 };

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    const palette = [
      "#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED",
      "#0EA5E9", "#059669", "#CA8A04", "#EA580C", "#9333EA",
    ];
    const map = {} as Record<InterpreterName, string>;
    interpreters.forEach((n, i) => { map[n] = palette[i % palette.length]; });
    return map;
  }, [interpreters]);

  const monthDeptData: SingleMonthDeptBar[] = React.useMemo(() => {
    if (!selectedMonth) return [];
    const mrow = yearData.find((d) => d.month === selectedMonth);
    return departments.map((dept) => {
      const rec: SingleMonthDeptBar = { group: OGLabel[dept] } as SingleMonthDeptBar;
      interpreters.forEach((itp) => {
        rec[itp] = mrow?.deptByInterpreter?.[itp]?.[dept] ?? 0;
      });
      return rec;
    });
  }, [yearData, selectedMonth, departments, interpreters]);

  const monthsToRender: MonthName[] =
    showAllMonths ? months : (selectedMonth ? [selectedMonth] : []);

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    if (showAllMonths) return deptMGIFooter;
    const perInterpreter = interpreters.map((itp) =>
      monthsToRender.reduce((acc, m) => {
        const r = yearData.find((d) => d.month === m);
        const sumThisMonth = departments.reduce(
          (s, dept) => s + (r?.deptByInterpreter?.[itp]?.[dept] ?? 0),
          0
        );
        return acc + sumThisMonth;
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [showAllMonths, deptMGIFooter, interpreters, monthsToRender, yearData, departments]);



  return (
    <>
      {/* Chart (เลือกเดือนเดียว) */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Meetings by Department — Month {selectedMonth || "-"} (Year {activeYear})
            </CardTitle>
            <Select
              value={selectedMonth || ""} // คุมให้เป็น string เสมอ
              onValueChange={(v) => setSelectedMonth(v as MonthName)}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthDeptData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip />
              <Legend />
              {interpreters.map((p) => (
                <Bar key={p} dataKey={p} name={p} fill={interpreterColors[p]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table A: Group × Months */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">DEDE Group Booking (Group / Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="p-2 text-left">Group</th>
                  {months.map((m) => (
                    <th key={m} className="p-2 text-right">{m}</th>
                  ))}
                  <th className="p-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  type GroupRow =
                    { department: string; TOTAL: number } & Record<MonthName, number>;
                  const row = months.reduce<GroupRow>(
                    (acc, m) => {
                      const r = yearData.find((d) => d.month === m);
                      const v = r?.deptMeetings?.[dept] ?? 0;
                      acc[m] = v;
                      acc.TOTAL += v;
                      return acc;
                    },
                    { department: OGLabel[dept], TOTAL: 0 } as GroupRow
                  );

                  return (
                    <tr key={dept} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                      <td className="p-2">{row.department}</td>
                      {months.map((m) => (
                        <td key={m} className="p-2 text-right">{row[m]}</td>
                      ))}
                      <td className="p-2 text-right font-semibold">{row.TOTAL}</td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 font-semibold">
                  <td className="p-2">Total</td>
                  {months.map((m) => {
                    const col = departments.reduce(
                      (a, dept) => a + (yearData.find((d) => d.month === m)?.deptMeetings?.[dept] || 0),
                      0
                    );
                    return <td key={m} className="p-2 text-right">{col}</td>;
                  })}
                  <td className="p-2 text-right">
                    {departments.reduce(
                      (a, dept) =>
                        a +
                        months.reduce(
                          (x, m) => x + (yearData.find((d) => d.month === m)?.deptMeetings?.[dept] || 0),
                          0
                        ),
                      0
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Table B: Month × Group × Interpreter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Month × Group × Interpreter (Year {activeYear})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllMonths((v) => !v)}
              className="whitespace-nowrap"
            >
              {showAllMonths ? "Show current month only" : "Show all months"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left">Month</th>
                  <th className="p-2 text-left">Group</th>
                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">{p}</th>
                  ))}
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthsToRender.map((m) => (
                  <React.Fragment key={m}>
                    {departments.map((dept, idx) => {
                      const r = yearData.find((d) => d.month === m);
                      const vals = interpreters.map((p) => r?.deptByInterpreter?.[p]?.[dept] ?? 0);
                      const total = vals.reduce((a, b) => a + b, 0);
                      const d = diffRange(vals);

                      return (
                        <tr key={`${m}-${dept}`} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                          {idx === 0 && (
                            <td className="p-2 align-top font-medium" rowSpan={departments.length}>
                              {m}
                            </td>
                          )}
                          <td className="p-2">{OGLabel[dept]}</td>
                          {interpreters.map((p, i) => (
                            <td key={p} className="p-2 text-right">{vals[i]}</td>
                          ))}
                          <td className={`p-2 text-right font-medium ${diffClass(d)}`}>{d}</td>
                          <td className="p-2 text-right font-semibold">{total}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
                <tr className="bg-emerald-50 text-emerald-900 font-semibold">
                  <td className="p-2" colSpan={2}>TOTAL</td>
                  {dynamicFooter.perInterpreter.map((v, idx) => (
                    <td key={idx} className="p-2 text-right">{v}</td>
                  ))}
                  <td className={`p-2 text-right ${diffClass(dynamicFooter.diff)}`}>{dynamicFooter.diff}</td>
                  <td className="p-2 text-right">{dynamicFooter.grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
