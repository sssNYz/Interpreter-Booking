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

import {
  InterpreterName,
  JobsApiResponse,
} from "@/types/admin-dashboard";

import { 
  diffClass, 
  createInterpreterColorPalette,
  getCurrentCalendarMonthStrict 
} from "@/utils/admin-dashboard";


export function JobsTab({ year }: { year: number }) {
  const [data, setData] = React.useState<JobsApiResponse | null>(null);

  React.useEffect(() => {
    fetch(`/api/admin-dashboard/jobs-total/${year}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const j = (await r.json()) as JobsApiResponse;
        setData(j);
      })
      .catch((e) => {
        console.error("Error fetching jobs data:", e);
        setData(null);
      });
  }, [year]);

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    if (!data) return {} as Record<InterpreterName, string>;
    return createInterpreterColorPalette(data.interpreters);
  }, [data]);

  // Show 0 values when no data instead of returning null
  const { interpreters, totalJobsStack, jobsFooter } = data || {
    interpreters: [],
    totalJobsStack: [],
    jobsFooter: { perInterpreter: [], grand: 0, diff: 0 }
  };
  const currentMonth = getCurrentCalendarMonthStrict(data?.months || []);

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
          ) : null}
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

                        {/* Color diff */}
                        <td className={`p-2 text-right font-medium ${diffClass(d)}`}>{d}</td>
                        <td className="p-2 text-right font-medium">{r.total}</td>
                      </tr>
                    );
                  })}

                  {/* TOTAL row*/}
                  <tr className="bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-50">
                    <td className="p-2">TOTAL</td>
                    {jobsFooter.perInterpreter.map((v: number, idx: number) => (
                      <td key={idx} className="p-2 text-right">{v}</td>
                    ))}
                    <td className={`p-2 text-right ${diffClass(jobsFooter.diff)}`}>{jobsFooter.diff}</td>
                    <td className="p-2 text-right">{jobsFooter.grand}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
