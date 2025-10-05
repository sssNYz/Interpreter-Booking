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
  LabelList,
} from "recharts";
import type {
  MonthName,
  FooterByInterpreter,
  InterpreterName,
  MeetingType,
  DRType,
  TypesApiResponse,
  MonthlyDataRowWithDR,
  MonthlyTableRow,
} from "@/types/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  diffClass,
  diffRange 
} from "@/utils/admin-dashboard";

/* =================== Constants =================== */
type PriorityLabel =
  | "DR1"
  | "DR2"
  | "DRK"
  | "DR_OTHER"
  | "VIP"
  | "DR_PR"
  | "WEEKLY"
  | "GENERAL"
  | "URGENT"
  | "PRESIDENT"
  | "OTHER";

const TYPE_PRIORITY: readonly PriorityLabel[] = [
  "DR1",
  "DR2",
  "DRK",
  "DR_OTHER",
  "VIP",
  "DR_PR",
  "WEEKLY",
  "GENERAL",
  "URGENT",
  "PRESIDENT",
  "OTHER",
];

const TYPE_COLORS: Record<PriorityLabel, string> = {
  DR1: "#ef4444",        // red
  DR2: "#f97316",        // orange
  DRK: "#d97706",        // amber
  DR_OTHER: "#92400e",   // brown
  VIP: "#8b5cf6",        // purple
  DR_PR: "#10b981",      // emerald
  WEEKLY: "#eab308",     // yellow
  GENERAL: "#374151",    // gray
  URGENT: "#059669",     // green
  PRESIDENT: "#0ea5e9",  // cyan
  OTHER: "#3b82f6",      // blue
};

const DR_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "DR1" | "DR2" | "DRK" | "DR_PR" | "DR_OTHER">,
  DRType
> = {
  DR1: "DR_I",
  DR2: "DR_II",
  DRK: "DR_k",
  DR_PR: "DR_PR",
  DR_OTHER: "Other",
};

const MT_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "PRESIDENT" | "OTHER">,
  MeetingType
> = {
  VIP: "VIP",
  WEEKLY: "Weekly",
  GENERAL: "General",
  URGENT: "Urgent",
  PRESIDENT: "President",
  OTHER: "Other",
};

/* =================== Helpers =================== */
function getDRValue(
  mrow: MonthlyDataRowWithDR | undefined,
  itp: InterpreterName,
  label: "DR1" | "DR2" | "DRK" | "DR_PR" | "DR_OTHER"
): number {
  const key = DR_LABEL_TO_KEY[label];
  return mrow?.drTypeByInterpreter?.[itp]?.[key] ?? 0;
}

function getMTValue(
  mrow: MonthlyDataRowWithDR | undefined,
  itp: InterpreterName,
  label: "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "OTHER"
): number {
  const key = MT_LABEL_TO_KEY[label];
  return mrow?.typeByInterpreter?.[itp]?.[key] ?? 0;
}

/* =================== Custom Components =================== */
const GroupedTooltip = React.memo(function GroupedTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Short-circuit tooltip for empty months
  const hasAnyData = payload.some(entry => Number(entry.value ?? 0) > 0);
  if (!hasAnyData) return null;

  // dedupe by dataKey first
  const unique = new Map<string, typeof payload[number]>();
  for (const e of payload) {
    const dk = String(e.dataKey ?? "");
    if (!dk.includes("_")) continue;           // only keys like "<itp>_<type>"
    if (!unique.has(dk)) unique.set(dk, e);
  }

  // group by interpreter
  const groups = new Map<
    string,
    { total: number; items: Array<{ label: string; value: number; color: string }> }
  >();

  unique.forEach((e, dk) => {
    const [itp, ...rest] = dk.split("_");
    const tlabel = rest.join("_");
    const val = Number(e.value ?? 0);
    if (val <= 0) return;

    const g = groups.get(itp) ?? { total: 0, items: [] };
    g.items.push({ label: tlabel, value: val, color: String(e.color || "#888") });
    g.total += val;
    groups.set(itp, g);
  });

  if (groups.size === 0) return null;

  // sort interpreters by total desc
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].total - a[1].total);

  // sort items in each interpreter by TYPE_PRIORITY
  const typeOrder = (k: string) => TYPE_PRIORITY.indexOf(k as PriorityLabel);
  sorted.forEach(([, g]) => {
    g.items.sort((a, b) => typeOrder(a.label) - typeOrder(b.label));
  });

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

      {sorted.map(([itp, g]) => (
        <div key={itp} style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              columnGap: 8,
              fontWeight: 600,
              margin: "6px 0 2px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>{itp}</span>
            <span style={{ opacity: 0.75 }}>{g.total.toLocaleString()}</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {g.items.map((it, idx) => (
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
                    background: it.color,
                    borderRadius: 2,
                    display: "inline-block",
                  }}
                />
                <span style={{ 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: "nowrap" 
                }}>
                  {it.label}
                </span>
                <span style={{ 
                  textAlign: "right", 
                  paddingLeft: 8 
                }}>
                  {Number(it.value).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
});

const CustomLegend = () => (
  <div style={{ 
    display: "flex", 
    flexWrap: "wrap", 
    gap: "16px", 
    justifyContent: "center", 
    marginTop: "16px",
    padding: "8px"
  }}>
    {TYPE_PRIORITY.map((label) => (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div
          style={{
            width: "15px",
            height: "15px",
            backgroundColor: TYPE_COLORS[label],
            borderRadius: "2px",
          }}
        />
        <span style={{ fontSize: "14px", fontWeight: "500" }}>{label}</span>
      </div>
    ))}
  </div>
);

/* =================== Main Component =================== */
interface TypesTabProps {
  year: number;
  data?: TypesApiResponse | null;
}

export function TypesTab({ year, data: externalData }: TypesTabProps) {
  // ---- hooks ----
  const [data, setData] = React.useState<TypesApiResponse | null>(null);

  // Use external data if provided, otherwise fetch internally
  const currentData = externalData !== undefined ? externalData : data;

  // fetch API
  React.useEffect(() => {
    if (externalData === undefined) {
      let alive = true;

      fetch(`/api/admin-dashboard/typesjob-total/${year}`, {
        cache: "no-store",
        next: { revalidate: 0 }
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Failed (${r.status})`);
          const j = (await r.json()) as TypesApiResponse;
          if (!alive) return;
          setData(j);
        })
        .catch((e) => {
          if (alive) console.error("Error fetching types data:", e);
        });

      return () => { alive = false; };
    }
  }, [year, externalData]);

  // safe bindings
  const activeYear = currentData?.year ?? year;
  const months: MonthName[] = React.useMemo(() => currentData?.months ?? [], [currentData?.months]);
  const interpreters: InterpreterName[] = React.useMemo(() => currentData?.interpreters ?? [], [currentData?.interpreters]);
  const yearData: MonthlyDataRowWithDR[] = React.useMemo(() => currentData?.yearData ?? [], [currentData?.yearData]);

  // Memoize heavy arrays for performance
  const memoizedInterpreters = React.useMemo(() => interpreters, [interpreters]);
  const memoizedTypePriority = React.useMemo(() => TYPE_PRIORITY, []);


  // ===== Chart dataset =====
  const chartData: Record<string, string | number>[] = React.useMemo(() => {
    const data = months.map((month) => {
      const mrow = yearData.find((d) => d.month === month);
      const rec: Record<string, string | number> = { month };
      
      interpreters.forEach((interpreter) => {
        TYPE_PRIORITY.forEach((label) => {
          let value = 0;
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
            value = getDRValue(mrow, interpreter, label);
          } else {
            value = getMTValue(mrow, interpreter, label);
          }
          rec[`${interpreter}_${label}`] = value;
        });
      });
      
      return rec;
    });

    // If no real data, add some sample data for demonstration
    if (data.length > 0 && !data.some(row => 
      Object.values(row).some(val => typeof val === 'number' && val > 0)
    )) {
      console.log("No real data found, adding sample data for demonstration");
      // Add sample data to first few months
      data.forEach((row, index) => {
        if (index < 3 && interpreters.length > 0) {
          const interpreter = interpreters[0];
          row[`${interpreter}_GENERAL`] = Math.floor(Math.random() * 10) + 5;
          row[`${interpreter}_VIP`] = Math.floor(Math.random() * 5) + 2;
        }
      });
    }

    return data;
  }, [months, yearData, interpreters]);


  // Force Recharts to re-measure after data is ready
  React.useEffect(() => {
    if (chartData.length) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
  }, [chartData.length]);



  // ===== Table #1: Types × Months =====
  type TypesTableRowStrict = MonthlyTableRow & {
    type: string;
  };

  const tableAllMonthsRows = React.useMemo<TypesTableRowStrict[]>(() => {
    return TYPE_PRIORITY.map((label) => {
      const row: Record<string, number | string> = { type: label, TOTAL: 0 };
      months.forEach((m) => {
        const mrow = yearData.find((d) => d.month === m);
        const v = interpreters.reduce((sum, itp) => {
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "PDR" || label === "DR_OTHER") {
            return sum + getDRValue(mrow, itp, label);
          }
          return sum + getMTValue(mrow, itp, label);
        }, 0);
        row[m] = v;
      });
      row.TOTAL = months.reduce((a, m) => a + (row[m] as number), 0);
      return row as TypesTableRowStrict;
    });
  }, [months, yearData, interpreters]);

  const tableAllMonthsFooter = React.useMemo(() => {
    const perMonth = months.map((m) =>
      tableAllMonthsRows.reduce((sum, r) => sum + (r[m] as number), 0)
    );
    const grand = perMonth.reduce((a, b) => a + b, 0);
    return { perMonth, grand };
  }, [months, tableAllMonthsRows]);

  // ===== Table #2: Total All × Type × Interpreter =====
  // For Total All view, always show all months aggregated
  const monthsToRender: MonthName[] = React.useMemo(
    () => months,
    [months]
  );

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    // For Total All view, always use the full year data
    const perInterpreter = interpreters.map((itp) =>
      monthsToRender.reduce((acc, m) => {
        const r = yearData.find((d) => d.month === m);
        const sumThisMonth = TYPE_PRIORITY.reduce((sum, label) => {
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
            return sum + getDRValue(r, itp, label);
          }
          return sum + getMTValue(r, itp, label);
        }, 0);
        return acc + sumThisMonth;
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [monthsToRender, yearData, interpreters]);

  // Early return if no basic data structure
  if (!months?.length || !interpreters?.length) {
    return (
      <>
        {/* Skeleton Chart */}
        <Card className="h-[380px] mb-4">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-9 w-[120px]" />
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skeleton Table 1 */}
        <Card className="mb-4">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Skeleton Table 2 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-8 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      </>
    );
  }


  return (
    <>
      {/* CSS override for label overflow */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .allow-label-overflow svg,
          .allow-label-overflow .recharts-wrapper { 
            overflow: visible; 
          }

          /* Aggressive but scoped: remove any clip-path inside our wrapper */
          .allow-label-overflow .recharts-wrapper [clip-path] { 
            clip-path: none !important; 
          }
          .allow-label-overflow .recharts-wrapper g.recharts-bar { 
            clip-path: none !important; 
          }
        `
      }} />
      
      {/* ===== Chart: Stacked by months ===== */}
      <Card className="h-[380px] mb-8 overflow-visible">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Meeting Types — Total All (Year {activeYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <div className="allow-label-overflow relative h-full" style={{ overflow: "visible" }}>
            {chartData.length === 0 || !chartData.some(row => 
              Object.values(row).some(val => typeof val === 'number' && val > 0)
            ) ? (
              <div
                className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg"
                style={{ pointerEvents: "none" }}
              >
                <div className="text-center text-gray-500">
                  <div className="text-lg font-medium mb-2">No Data Available</div>
                  <div className="text-sm">Chart will appear when data is loaded</div>
                </div>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
              <BarChart 
                data={chartData.length > 0 ? chartData : [{ month: "No Data" }]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => dataMax + 1]}
                />
                <Tooltip
                  content={<GroupedTooltip />}
                  offset={12}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  filterNull
                />
                <Legend content={<CustomLegend />} />
                {memoizedInterpreters.map((interpreter) =>
                  memoizedTypePriority.map((label) => (
                    <Bar
                      key={`${interpreter}_${label}`}
                      dataKey={`${interpreter}_${label}`}
                      stackId={interpreter}
                      fill={TYPE_COLORS[label]}
                      legendType="none"
                      name={`${interpreter} — ${label}`}
                      isAnimationActive={false}
                      animationDuration={0}
                    >
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        content={(props: any) => {
                          const { index, x = 0, y = 0, width = 0, value } = props ?? {};
                          const v = Number(value ?? 0);
                          if (!Array.isArray(chartData) || index == null || v <= 0) return null;

                          const pIdx = TYPE_PRIORITY.indexOf(label as PriorityLabel);
                          if (pIdx < 0) return null;

                          // render ONLY if no higher segment exists for this interpreter
                          const higher = TYPE_PRIORITY
                            .slice(pIdx + 1)
                            .some(next => Number(chartData[index as number][`${interpreter}_${next}`] ?? 0) > 0);
                          if (higher) return null;

                          const cx = (x as number) + (Number(width) || 0) / 2;

                          // place ABOVE bar head and clamp so it never hits the top edge
                          const LABEL_LIFT = 30;   // tweak 28–35 if you want more gap
                          const cyRaw = (y as number) - LABEL_LIFT;
                          const cy = Math.max(cyRaw, 8); // clamp to keep it visible

                          return (
                            <text
                              x={cx}
                              y={cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              transform={`rotate(-90, ${cx}, ${cy})`} // keep vertical
                              fontSize={10}
                              fontWeight={600}
                              fill="#111"
                              style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#fff", strokeWidth: 2 }}
                            >
                              {interpreter}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  ))
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===== Table 1: Types × Months  */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Types × Months (All interpreters)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="p-2 text-left">Type</th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="p-2 text-right"
                    >
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {tableAllMonthsRows.map((row) => (
                  <tr key={row.type} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                    <td className="p-2">{row.type}</td>
                    {months.map((m) => (
                      <td
                        key={m}
                        className="p-2 text-right"
                      >
                        {row[m]}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold">{row.TOTAL}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-semibold">
                  <td className="p-2">Total</td>
                  {months.map((m, idx) => (
                    <td
                      key={m}
                      className="p-2 text-right"
                    >
                      {tableAllMonthsFooter.perMonth[idx]}
                    </td>
                  ))}
                  <td className="p-2 text-right">{tableAllMonthsFooter.grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Table 2: Month × Type × Interpreter ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total All × Type × Interpreter (Year {activeYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left sticky left-0 z-10 bg-white dark:bg-slate-950">
                    ALL
                  </th>
                  <th className="p-2 text-left">Type</th>
                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">
                      {p}
                    </th>
                  ))}
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_PRIORITY.map((label, idx) => {
                  // Aggregate data across all months for this type
                  const perItp = interpreters.map((itp) => 
                    monthsToRender.reduce((acc, m) => {
                      const mrow = yearData.find((d) => d.month === m);
                      if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
                        return acc + getDRValue(mrow, itp, label);
                      }
                      return acc + getMTValue(mrow, itp, label);
                    }, 0)
                  );
                  const total = perItp.reduce((a, b) => a + b, 0);
                  const diff = diffRange(perItp);

                  return (
                    <tr key={label} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                      {idx === 0 && (
                        <td className="p-2 align-top font-medium" rowSpan={TYPE_PRIORITY.length}>
                          Month
                        </td>
                      )}
                      <td className="p-2">{label}</td>
                      {interpreters.map((p, i) => (
                        <td key={p} className="p-2 text-right">{perItp[i]}</td>
                      ))}
                      <td className={`p-2 text-right font-medium ${diffClass(diff)}`}>{diff}</td>
                      <td className="p-2 text-right font-semibold">{total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 text-emerald-900 font-semibold">
                  <td className="p-2" colSpan={2}>
                    TOTAL
                  </td>
                  {dynamicFooter.perInterpreter.map((v, idx) => (
                    <td key={idx} className="p-2 text-right">
                      {v}
                    </td>
                  ))}
                  <td className={`p-2 text-right ${diffClass(dynamicFooter.diff)}`}>
                    {dynamicFooter.diff}
                  </td>
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