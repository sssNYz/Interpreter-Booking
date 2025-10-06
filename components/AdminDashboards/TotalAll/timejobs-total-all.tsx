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
  ReferenceLine,
} from "recharts";

import {
  HoursRow,
  FooterByInterpreter,
  InterpreterName,
  HoursApiResponse,
} from "@/types/admin-dashboard";

import { 
  diffClass,
  formatHoursDecimal,
  buildTwoHourTicks,
  getInterpreterColorPaletteAsMap
} from "@/utils/admin-dashboard";

/* =================== Custom Components =================== */
const HoursTooltip = React.memo(function HoursTooltip({
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
              {formatHoursDecimal(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});


type RowIndexable = HoursRow & Partial<Record<InterpreterName, number>> & { total?: number };

const getValue = (row: RowIndexable, person: InterpreterName): number => {
  const value = row[person];
  return typeof value === 'number' ? value : 0;
};

interface HoursTabProps {
  year: number;
  data?: HoursApiResponse | null;
}

export function HoursTab({ year, data: externalData }: HoursTabProps) {
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


  const interpreterColors = React.useMemo<Map<InterpreterName, string>>(() => {
    return getInterpreterColorPaletteAsMap(interpreters);
  }, [interpreters]);

  // max minutes for Y axis
  const maxMinutes = React.useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const p of interpreters) {
        const v = getValue(row as RowIndexable, p);
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
              {/* Dashed baseline for readability */}
              <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="3 3" />
              <Tooltip
                content={<HoursTooltip />}
                offset={12}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                filterNull
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
                    ALL
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

                  return (
                    <tr
                      key={r.month}
                      className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40"
                    >
                      <td className="p-2 sticky left-0 z-10 bg-inherit">Month</td>

                      {interpreters.map((p) => (
                        <td key={p} className="p-2 text-right">
                          {formatHoursDecimal(getValue(rowData, p))}
                        </td>
                      ))}
                      {/* Diff */}
                      <td className={`p-2 text-right font-medium ${diffClass(d)}`}>
                        {formatHoursDecimal(d)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatHoursDecimal(rowData.total ?? 0)}
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
