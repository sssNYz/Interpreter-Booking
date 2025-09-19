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
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
  DepartmentsApiResponse,
} from "@/types/admin-dashboard";
import { OwnerGroupLabel as OGLabel } from "@/types/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

import { 
  diffRange, 
  diffClass
} from "@/utils/admin-dashboard";



/* =================== Constants =================== */
type TechCategory = "IoT" | "Hardware" | "Software" | "Other";

const TECH_CATEGORIES: readonly TechCategory[] = [
  "IoT",
  "Hardware", 
  "Software",
  "Other"
];

const TECH_COLORS: Record<TechCategory, string> = {
  IoT: "#ef4444",        // red
  Hardware: "#f97316",   // orange
  Software: "#10b981",   // emerald
  Other: "#3b82f6",      // blue
};

/* =================== Custom Components =================== */
const TechTooltip = React.memo(function TechTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // dedupe by dataKey first
  const unique = new Map<string, typeof payload[number]>();
  for (const e of payload) {
    const dk = String(e.dataKey ?? "");
    if (!dk.includes("_")) continue;           // only keys like "<itp>_<category>"
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

  // sort items in each interpreter by TECH_CATEGORIES
  const categoryOrder = (k: string) => TECH_CATEGORIES.indexOf(k as TechCategory);
  sorted.forEach(([, g]) => {
    g.items.sort((a, b) => categoryOrder(a.label) - categoryOrder(b.label));
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

const TechLegend = () => (
  <div style={{ 
    display: "flex", 
    flexWrap: "wrap", 
    gap: "12px", 
    justifyContent: "center", 
    marginTop: "8px",
    padding: "4px"
  }}>
    {TECH_CATEGORIES.map((label) => (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <div
          style={{
            width: "15px",
            height: "15px",
            backgroundColor: TECH_COLORS[label],
            borderRadius: "2px",
          }}
        />
        <span style={{ fontSize: "14px", fontWeight: "400" }}>{label}</span>
      </div>
    ))}
  </div>
);

/* ========= Component ========= */

interface DeptTabProps {
  year: number;
  data?: DepartmentsApiResponse | null;
}

export function DeptTab({ year, data: externalData }: DeptTabProps) {
  const [data, setData] = React.useState<DepartmentsApiResponse | null>(null);

  // Use external data if provided, otherwise fetch internally
  const currentData = externalData !== undefined ? externalData : data;

  React.useEffect(() => {
    if (externalData === undefined) {
      let alive = true;

      fetch(`/api/admin-dashboard/dept-total/${year}`, {
        cache: "no-store"
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`Failed (${r.status})`);
          const j = (await r.json()) as DepartmentsApiResponse;
          if (alive) {
            setData(j);
          }
        })
        .catch((e) => {
          if (alive) console.error("Error fetching dept data:", e);
        });

      return () => { alive = false; };
    }
  }, [year, externalData]);

  // Data from API or fallback
  const activeYear = React.useMemo(() => currentData?.year ?? year, [currentData?.year, year]);
  const months: MonthName[] = React.useMemo(() => currentData?.months ?? [], [currentData?.months]);
  const interpreters: InterpreterName[] = React.useMemo(() => currentData?.interpreters ?? [], [currentData?.interpreters]);
  const departments: OwnerGroup[] = React.useMemo(() => currentData?.departments ?? [], [currentData?.departments]);
  const yearData: MonthlyDataRow[] = React.useMemo(() => currentData?.yearData ?? [], [currentData?.yearData]);


  // Create tech category data using real department data
  const chartData: Record<string, string | number>[] = React.useMemo(() => {
    return months.map((month) => {
      const mrow = yearData.find((d) => d.month === month);
      const rec: Record<string, string | number> = { month };
      
      interpreters.forEach((interpreter) => {
        TECH_CATEGORIES.forEach((category) => {
          // Map tech categories to actual department data
          // Since we don't have tech categories in the database yet, 
          // we'll use the existing department data as a proxy
          let value = 0;
          
          if (mrow?.deptByInterpreter?.[interpreter]) {
            const deptData = mrow.deptByInterpreter[interpreter];
            
            // Map tech categories to existing departments
            switch (category) {
              case "IoT":
                // Use "iot" department data for IoT
                value = deptData["iot"] || 0;
                break;
              case "Hardware":
                // Use "hardware" department data for Hardware  
                value = deptData["hardware"] || 0;
                break;
              case "Software":
                // Use "software" department data for Software
                value = deptData["software"] || 0;
                break;
              case "Other":
                // Use "other" department data for Other
                value = deptData["other"] || 0;
                break;
            }
          }
          
          rec[`${interpreter}_${category}`] = value;
        });
      });
      
      return rec;
    });
  }, [months, yearData, interpreters]);

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
  }, [interpreters, monthsToRender, yearData, departments]);

  // Early return if no basic data structure
  if (!months?.length || !interpreters?.length) {
    return (
      <>
        {/* Skeleton Chart */}
        <Card className="h-[380px] mb-4">
          <CardHeader className="pb-0">
            <Skeleton className="h-6 w-64" />
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
      
      {/* Chart select month */}
      <Card className="h-[380px] mb-8 overflow-visible">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Tech Categories — Total All (Year {activeYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <div className="allow-label-overflow relative h-full" style={{ overflow: "visible" }}>
            <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
              <BarChart 
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => dataMax + 1]}
                />
                <Tooltip
                  content={<TechTooltip />}
                  offset={12}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  filterNull
                />
                <Legend content={<TechLegend />} />
                {interpreters.map((interpreter) =>
                  TECH_CATEGORIES.map((category) => (
                    <Bar
                      key={`${interpreter}_${category}`}
                      dataKey={`${interpreter}_${category}`}
                      stackId={interpreter}
                      fill={TECH_COLORS[category]}
                      legendType="none"
                      name={`${interpreter} — ${category}`}
                      isAnimationActive={false}
                      animationDuration={0}
                    >
                      <LabelList
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        content={(props: any) => {
                          const { index, x = 0, y = 0, width = 0, value } = props ?? {};
                          const v = Number(value ?? 0);
                          if (!Array.isArray(chartData) || index == null || v <= 0) return null;

                          const pIdx = TECH_CATEGORIES.indexOf(category as TechCategory);
                          if (pIdx < 0) return null;

                          // render ONLY if no higher segment exists for this interpreter
                          const higher = TECH_CATEGORIES
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
                        <td
                          key={m}
                          className="p-2 text-right"
                        >
                          {row[m]}
                        </td>
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
                    return (
                      <td
                        key={m}
                        className="p-2 text-right"
                      >
                        {col}
                      </td>
                    );
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
          <CardTitle className="text-base">
            Total All × Group × Interpreter (Year {activeYear})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left">All</th>
                  <th className="p-2 text-left">Group</th>
                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">{p}</th>
                  ))}
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, idx) => {
                  // Aggregate data across all months for this department
                  const vals = interpreters.map((p) => 
                    monthsToRender.reduce((acc, m) => {
                      const r = yearData.find((d) => d.month === m);
                      return acc + (r?.deptByInterpreter?.[p]?.[dept] ?? 0);
                    }, 0)
                  );
                  const total = vals.reduce((a, b) => a + b, 0);
                  const d = diffRange(vals);

                  return (
                    <tr key={dept} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                      {idx === 0 && (
                        <td className="p-2 align-top font-medium" rowSpan={departments.length}>
                          Month
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
