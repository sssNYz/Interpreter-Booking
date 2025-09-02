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

// ⬇️ Use your existing types
import {
  MonthName,
  JobsRow,
  FooterByInterpreter,
  InterpreterName,
} from "@/types/overview";

type ApiResponse = {
  months: MonthName[];
  interpreters: InterpreterName[];
  totalJobsStack: JobsRow[];
  jobsFooter: FooterByInterpreter;
  year: number;
};

/** ใช้ “เดือนปฏิทิน” ปัจจุบัน (Jan..Dec) เพื่อไฮไลต์ในตาราง */
function getCurrentCalendarMonth(months: MonthName[]): MonthName | "" {
  if (!months?.length) return "";
  const idx = new Date().getMonth(); // 0=Jan ... 11=Dec
  return months[idx] ?? "";
}

/** ✅ สี Diff แบบ 2 ระดับ: 0 = เขียว, >0 = แดง */
function diffClass(v: number): string {
  return v === 0 ? "text-emerald-700" : "text-red-600";
}

export function JobsTab({ year }: { year: number }) {
  const [data, setData] = React.useState<ApiResponse | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(`/api/admin-dashboard/jobs-total/${year}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = (await r.json()) as ApiResponse;
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) console.error("Error fetching jobs data:", e);
      });
    return () => {
      alive = false;
    };
  }, [year]);

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    if (!data) return {} as Record<InterpreterName, string>;
    const palette = [
      "#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED",
      "#0EA5E9", "#059669", "#CA8A04", "#EA580C", "#9333EA",
    ];
    const map = {} as Record<InterpreterName, string>;
    data.interpreters.forEach((n, i) => {
      map[n] = palette[i % palette.length];
    });
    return map;
  }, [data]);

  // Show 0 values when no data instead of returning null
  const { interpreters, totalJobsStack, jobsFooter } = data || {
    interpreters: [],
    totalJobsStack: [],
    jobsFooter: { perInterpreter: [], grand: 0, diff: 0 }
  };
  const currentMonth = getCurrentCalendarMonth(data?.months || []);

  return (
    <>
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Total Jobs per Month (Year {data?.year || new Date().getFullYear()})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {totalJobsStack.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totalJobsStack}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                {interpreters.map((p) => (
                  <Bar key={p} dataKey={p} fill={interpreterColors[p]} name={p} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">No Data Available</p>
                <p className="text-sm">Total Jobs: 0</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Monthly Jobs Summary (Year {data?.year || new Date().getFullYear()}) with Diff
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalJobsStack.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    {/* Month header: sticky + same bg as thead */}
                    <th className="p-2 text-left sticky left-0 z-10 bg-slate-100 dark:bg-slate-800">
                      Month
                    </th>
                    {interpreters.map((p) => (
                      <th key={p} className="p-2 text-right">{p}</th>
                    ))}
                    {/* Diff before Total */}
                    <th className="p-2 text-right">Diff</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totalJobsStack.map((r) => {
                    const vals = interpreters.map(
                      (p) => Number(r[p as InterpreterName] ?? 0)
                    );
                    const d = Math.max(...vals) - Math.min(...vals);
                    const isCurrent = r.month === currentMonth;

                    return (
                      <tr
                        key={r.month}
                        className={[
                          "border-b",
                          isCurrent
                            ? "bg-blue-100 dark:bg-blue-900/40 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
                            : "odd:bg-white even:bg-muted/30 hover:bg-muted/40",
                        ].join(" ").trim()}
                      >
                        {/* sticky cell inherits row bg to keep highlight color */}
                        <td className="p-2 sticky left-0 z-10 bg-inherit">
                          {r.month}
                        </td>

                        {interpreters.map((p) => (
                          <td key={p} className="p-2 text-right">
                            {Number(r[p as InterpreterName] ?? 0)}
                          </td>
                        ))}

                        {/* ✅ ใส่สี Diff แบบ 2 สี */}
                        <td className={`p-2 text-right font-medium ${diffClass(d)}`}>{d}</td>
                        <td className="p-2 text-right font-medium">{r.total}</td>
                      </tr>
                    );
                  })}

                  {/* TOTAL row — keep green on hover + สี Diff แบบ 2 สี */}
                  <tr className="bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-50">
                    <td className="p-2">TOTAL</td>
                    {jobsFooter.perInterpreter.map((v, idx) => (
                      <td key={idx} className="p-2 text-right">{v}</td>
                    ))}
                    <td className={`p-2 text-right ${diffClass(jobsFooter.diff)}`}>{jobsFooter.diff}</td>
                    <td className="p-2 text-right">{jobsFooter.grand}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium">No Data Available</p>
              <p className="text-sm">All values show as 0</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
