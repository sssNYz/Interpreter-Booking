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
  formatHoursDecimal,
  buildTwoHourTicks,
  getInterpreterColorPaletteAsMap,
  getCurrentCalendarMonthStrict
} from "@/utils/admin-dashboard";


/** Helper: index a row by interpreter without using `any` */
type RowIndexable = HoursRow & Partial<Record<InterpreterName, number>> & { total?: number };
const getValue = (row: RowIndexable, person: InterpreterName): number =>
  Number((row as Record<InterpreterName, number>)[person] ?? 0);

export function HoursTab({ year }: { year: number }) {
  const [data, setData] = React.useState<HoursApiResponse | null>(null);

  React.useEffect(() => {
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
  }, [year]);

 // Data extraction with defaults
  const interpreters: InterpreterName[] = data?.interpreters ?? [];
  const rows: HoursRow[] = data?.totalHoursLineMinutes ?? [];
  const footer: FooterByInterpreter | null = data?.hoursFooter ?? null;
  const theYear = data?.year ?? year;

  // current month for highlight
  const currentMonth = React.useMemo<MonthName | "">(() => {
    return getCurrentCalendarMonthStrict(data?.months || []);
  }, [data]);

  const interpreterColors = React.useMemo<Map<InterpreterName, string>>(() => {
    return getInterpreterColorPaletteAsMap(interpreters);
  }, [interpreters]);

  // max minutes for Y axis
  const maxMinutes = React.useMemo(() => {
    let max = 0;
    for (const row of rows as RowIndexable[]) {
      for (const p of interpreters) {
        const v = getValue(row, p);
        if (v > max) max = v;
      }
    }
    return max;
  }, [rows, interpreters]);

  // Y axis ticks and domain
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
            <BarChart data={rows as RowIndexable[]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
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
                  fill={interpreterColors.get(p) ?? "#94a3b8"}
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
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(rows as RowIndexable[]).map((r) => {
                  const vals = interpreters.map((p) => getValue(r, p));
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

                      {interpreters.map((p) => (
                        <td key={p} className="p-2 text-right">
                          {formatHoursDecimal(getValue(r, p))}
                        </td>
                      ))}
                      {/* Diff */}
                      <td className={`p-2 text-right font-medium ${diffClass(d)}`}>
                        {formatHoursDecimal(d)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatHoursDecimal((r as RowIndexable).total ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                {/* TOTAL row */}
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
