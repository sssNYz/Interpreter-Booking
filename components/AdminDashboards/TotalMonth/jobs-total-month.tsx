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

/* =================== Custom Components =================== */
const JobsTooltip = React.memo(function JobsTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; dataKey: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #ddd",
      padding: 10,
      fontSize: 12,
      borderRadius: 8,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      maxWidth: 280,
      zIndex: 9999,
      position: "relative"
    }}>
      <div style={{ 
        fontWeight: 700, 
        marginBottom: 8,
        fontVariantNumeric: "tabular-nums"
      }}>
        {label}
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {payload.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "12px 1fr auto",
              alignItems: "center",
              columnGap: 10,
              padding: "2px 0",
              lineHeight: 1.4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: item.color,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            <span style={{ 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap" 
            }}>
              {item.name}
            </span>
            <span style={{ 
              textAlign: "right", 
              paddingLeft: 8 
            }}>
              {Number(item.value).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});


interface JobsTabProps {
  year: number;
  data?: JobsApiResponse | null;
  selectedMonth?: string;
}

export function JobsTab({ year, data: externalData, selectedMonth }: JobsTabProps) {
  const [data, setData] = React.useState<JobsApiResponse | null>(null);

  // Use external data if provided, otherwise fetch internally
  const currentData = externalData !== undefined ? externalData : data;

  React.useEffect(() => {
    if (externalData === undefined) {
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
    }
  }, [year, externalData]);

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    if (!currentData) return {} as Record<InterpreterName, string>;
    return createInterpreterColorPalette(currentData.interpreters);
  }, [currentData]);

  // Show 0 values when no data instead of returning null
  const { interpreters, totalJobsStack, jobsFooter } = currentData || {
    interpreters: [],
    totalJobsStack: [],
    jobsFooter: { perInterpreter: [], grand: 0, diff: 0 }
  };
  
  // Use selectedMonth from props, fallback to current month
  const currentMonth = selectedMonth || getCurrentCalendarMonthStrict(currentData?.months || []);
  
  // Filter data for selected month only
  const selectedMonthData = totalJobsStack.find(row => row.month === currentMonth);
  const chartData = selectedMonthData ? [selectedMonthData] : [];

  return (
    <>
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Total Jobs for {currentMonth} (Year {currentData?.year || new Date().getFullYear()})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  content={<JobsTooltip />}
                  offset={12}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  filterNull
                />
                <Legend />
                {interpreters.map((p) => (
                  <Bar key={p} dataKey={p} fill={interpreterColors[p]} name={p} maxBarSize={80} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available for {currentMonth}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Monthly Jobs Summary (Year {currentData?.year || new Date().getFullYear()}) with Diff
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
                    const d = vals.length > 0 ? Math.max(...vals) - Math.min(...vals) : 0;
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
