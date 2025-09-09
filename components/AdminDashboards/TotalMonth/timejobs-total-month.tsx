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
  MonthName,
  HoursRow,
  FooterByInterpreter,
  InterpreterName,
  HoursApiResponse,
} from "@/types/admin-dashboard";

import { 
  diffClass,
  buildTwoHourTicks,
  getInterpreterColorPaletteAsMap,
  getCurrentCalendarMonthStrict
} from "@/utils/admin-dashboard";


type RowIndexable = HoursRow & Partial<Record<InterpreterName, number>> & { total?: number };

const getValue = (row: RowIndexable, person: InterpreterName): number => {
  const value = row[person];
  return typeof value === 'number' ? value : 0;
};

interface HoursTabProps {
  year: number;
  data?: HoursApiResponse | null;
  selectedMonth?: string;
}

export function HoursTab({ year, data: externalData, selectedMonth }: HoursTabProps) {
  const [data, setData] = React.useState<HoursApiResponse | null>(null);

  // Use external data if provided, otherwise fetch internally
  const currentData = externalData !== undefined ? externalData : data;

  React.useEffect(() => {
    if (externalData === undefined) {
      let alive = true;
      fetch(`/api/admin-dashboard/timejobs-total/${year}`, {
        cache: "no-store",
        next: { revalidate: 0 },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Failed (${r.status})`);
          const j = (await r.json()) as HoursApiResponse;
          if (alive) setData(j);
        })
        .catch((e) => {
          if (alive) console.error("Error fetching hours data:", e);
        });
      return () => {
        alive = false;
      };
    }
  }, [year, externalData]);

  // Data extraction with defaults
  const interpreters: InterpreterName[] = React.useMemo(() => currentData?.interpreters ?? [], [currentData?.interpreters]);
  const rows: HoursRow[] = React.useMemo(() => currentData?.totalHoursLineMinutes ?? [], [currentData?.totalHoursLineMinutes]);
  const footer: FooterByInterpreter | null = React.useMemo(() => currentData?.hoursFooter ?? null, [currentData?.hoursFooter]);
  const theYear = React.useMemo(() => currentData?.year ?? year, [currentData?.year, year]);

  // current month for highlight - use selectedMonth if provided, otherwise fallback to current month
  const currentMonth = React.useMemo<MonthName | "">(() => {
    if (selectedMonth) return selectedMonth;
    return getCurrentCalendarMonthStrict(currentData?.months || []);
  }, [selectedMonth, currentData]);

  const interpreterColors = React.useMemo<Map<InterpreterName, string>>(() => {
    return getInterpreterColorPaletteAsMap(interpreters);
  }, [interpreters]);


  // Filter data for selected month only
  const selectedMonthData = rows.find(row => row.month === currentMonth);
  const chartData = selectedMonthData ? [selectedMonthData] : [];

  // Y axis ticks and domain for selected month data
  const maxMinutesSelected = React.useMemo(() => {
    if (!selectedMonthData) return 0;
    let max = 0;
    for (const p of interpreters) {
      const v = getValue(selectedMonthData as RowIndexable, p);
      if (v > max) max = v;
    }
    return max;
  }, [selectedMonthData, interpreters]);

  const yTicks = React.useMemo(() => buildTwoHourTicks(maxMinutesSelected), [maxMinutesSelected]);
  const yDomain: [number, number] = [0, yTicks[yTicks.length - 1] ?? 0];

  // Render
  return (
    <>
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Total Time for {currentMonth} (Year {theYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData as RowIndexable[]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  tickFormatter={(v) => {
                    const hours = Math.floor(Number(v) / 60);
                    const minutes = Number(v) % 60;
                    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
                  }}
                  allowDecimals={false}
                  width={80}
                  tickMargin={6}
                />
                <Tooltip
                  formatter={(value) => {
                    const hours = Math.floor(Number(value) / 60);
                    const minutes = Number(value) % 60;
                    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
                  }}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend />
                {interpreters.map((p) => (
                  <Bar
                    key={p}
                    dataKey={p}
                    name={p}
                    fill={interpreterColors.get(p) ?? "#94a3b8"}
                    maxBarSize={80}
                  />
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
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowData = r as RowIndexable;
                  const vals = interpreters.map((p) => getValue(rowData, p));
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
                          ? "bg-blue-100 dark:bg-blue-900/40 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
                          : "odd:bg-white even:bg-muted/30 hover:bg-muted/40",
                      ].join(" ").trim()}
                    >
                      <td className="p-2 sticky left-0 z-10 bg-inherit">{r.month}</td>

                      {interpreters.map((p) => {
                        const minutes = getValue(rowData, p);
                        const hours = Math.floor(minutes / 60);
                        const mins = minutes % 60;
                        const timeDisplay = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                        return (
                          <td key={p} className="p-2 text-right">
                            {timeDisplay}
                          </td>
                        );
                      })}
                      {/* Diff */}
                      <td className={`p-2 text-right font-medium ${diffClass(d)}`}>
                        {(() => {
                          const hours = Math.floor(d / 60);
                          const mins = d % 60;
                          return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                        })()}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {(() => {
                          const totalMinutes = rowData.total ?? 0;
                          const hours = Math.floor(totalMinutes / 60);
                          const mins = totalMinutes % 60;
                          return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                        })()}
                      </td>
                    </tr>
                  );
                })}
                {/* TOTAL row */}
                <tr className="bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-50">
                  <td className="p-2">TOTAL</td>
                  {(footer?.perInterpreter ?? []).map((v, idx) => {
                    const hours = Math.floor(v / 60);
                    const mins = v % 60;
                    const timeDisplay = mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                    return (
                      <td key={idx} className="p-2 text-right">
                        {timeDisplay}
                      </td>
                    );
                  })}
                  <td className={`p-2 text-right ${diffClass(footer?.diff ?? 0)}`}>
                    {(() => {
                      const diffMinutes = footer?.diff ?? 0;
                      const hours = Math.floor(diffMinutes / 60);
                      const mins = diffMinutes % 60;
                      return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                    })()}
                  </td>
                  <td className="p-2 text-right">
                    {(() => {
                      const grandMinutes = footer?.grand ?? 0;
                      const hours = Math.floor(grandMinutes / 60);
                      const mins = grandMinutes % 60;
                      return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
                    })()}
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
