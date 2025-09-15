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
  FooterByInterpreter,
  InterpreterName,
  MeetingType,
  DRType,
  TypesApiResponse,
  MonthlyDataRowWithDR,
  MonthlyTableRow,
} from "@/types/admin-dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  diffClass,
  getCurrentCalendarMonth,
  diffRange 
} from "@/utils/admin-dashboard";

/* =================== Constants =================== */
type PriorityLabel =
  | "DR1"
  | "DR2"
  | "DRK"
  | "DR_OTHER"
  | "VIP"
  | "PDR"
  | "WEEKLY"
  | "GENERAL"
  | "URGENT"
  | "OTHER";


const TYPE_COLORS: Record<PriorityLabel, string> = {
  DR1: "#ef4444",        // red
  DR2: "#f97316",        // orange
  DRK: "#d97706",        // amber
  DR_OTHER: "#92400e",   // brown
  VIP: "#8b5cf6",        // purple
  PDR: "#10b981",        // emerald
  WEEKLY: "#eab308",     // yellow
  GENERAL: "#374151",    // gray
  URGENT: "#059669",     // green
  OTHER: "#3b82f6",      // blue
};


const DR_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "DR1" | "DR2" | "DRK" | "PDR" | "DR_OTHER">,
  DRType
> = {
  DR1: "DR_I",
  DR2: "DR_II",
  DRK: "DR_k",
  PDR: "PR_PR",
  DR_OTHER: "Other",
};

const MT_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "OTHER">,
  MeetingType
> = {
  VIP: "VIP",
  WEEKLY: "Weekly",
  GENERAL: "General",
  URGENT: "Augent",
  OTHER: "Other",
};

/* =================== Helpers =================== */
function getDRValue(
  mrow: MonthlyDataRowWithDR | undefined,
  itp: InterpreterName,
  label: "DR1" | "DR2" | "DRK" | "PDR" | "DR_OTHER"
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
const TYPE_PRIORITY = [
  "DR1","DR2","DRK","DR_OTHER","VIP","PDR","WEEKLY","GENERAL","URGENT","OTHER"
] as const;
const typeOrder = (k: string) => TYPE_PRIORITY.indexOf(k as PriorityLabel);

export const GroupedTooltip = React.memo(function GroupedTooltip({
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
            width: "12px",
            height: "12px",
            backgroundColor: TYPE_COLORS[label],
            borderRadius: "2px",
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: "500" }}>{label}</span>
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
  const [selectedMonth, setSelectedMonth] = React.useState<MonthName | "">("");

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
          setSelectedMonth((prev) => (prev ? prev : getCurrentCalendarMonth(j.months)));
        })
        .catch((e) => {
          if (alive) console.error("Error fetching types data:", e);
        });

      return () => { alive = false; };
    } else if (externalData) {
      setSelectedMonth((prev) => (prev ? prev : getCurrentCalendarMonth(externalData.months)));
    }
  }, [year, externalData]);

  // safe bindings
  const activeYear = currentData?.year ?? year;
  const months: MonthName[] = React.useMemo(() => currentData?.months ?? [], [currentData?.months]);
  const interpreters: InterpreterName[] = React.useMemo(() => currentData?.interpreters ?? [], [currentData?.interpreters]);
  const yearData: MonthlyDataRowWithDR[] = React.useMemo(() => currentData?.yearData ?? [], [currentData?.yearData]);
  // const typesMGIFooter: FooterByInterpreter = React.useMemo(() => 
  //   currentData?.typesMGIFooter ?? { perInterpreter: [], grand: 0, diff: 0 }, [currentData?.typesMGIFooter]);

  // current month for highlight
  const currentMonth = React.useMemo<MonthName | "">(
    () => (months.length ? getCurrentCalendarMonth(months) : ""),
    [months]
  );

  // ===== Chart dataset =====
  const chartData: Record<string, string | number>[] = React.useMemo(() => {
    return months.map((month) => {
      const mrow = yearData.find((d) => d.month === month);
      const rec: Record<string, string | number> = { month };
      
      interpreters.forEach((interpreter) => {
        TYPE_PRIORITY.forEach((label) => {
          let value = 0;
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "PDR" || label === "DR_OTHER") {
            value = getDRValue(mrow, interpreter, label);
          } else {
            value = getMTValue(mrow, interpreter, label);
          }
          rec[`${interpreter}_${label}`] = value;
        });
      });
      
      return rec;
    });
  }, [months, yearData, interpreters]);


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

  // ===== Table #2: Month × Type × Interpreter =====
  const groupSize = TYPE_PRIORITY.length;
  const monthsToRender: MonthName[] = months;

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    const perInterpreter = interpreters.map((itp) =>
      TYPE_PRIORITY.reduce((sum, label) => {
        const mrow = yearData.find((d) => d.month === selectedMonth);
        if (label === "DR1" || label === "DR2" || label === "DRK" || label === "PDR" || label === "DR_OTHER") {
          return sum + getDRValue(mrow, itp, label);
        }
        return sum + getMTValue(mrow, itp, label);
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [yearData, selectedMonth, interpreters]);

  return (
    <>
      {/* ===== Chart: Stacked by months ===== */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Meeting Types — All Months (Year {activeYear})
            </CardTitle>
            <Select
              value={selectedMonth || ""}
              onValueChange={(v) => setSelectedMonth(v as MonthName)}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[320px]">
          <div className="w-full h-full" style={{ overflow: "visible" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  content={<GroupedTooltip />}
                  offset={12}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  filterNull
                />
                <Legend content={<CustomLegend />} />
                {interpreters.map((interpreter) =>
                  TYPE_PRIORITY.map((label) => (
                    <Bar
                      key={`${interpreter}_${label}`}
                      dataKey={`${interpreter}_${label}`}
                      stackId={interpreter}
                      fill={TYPE_COLORS[label]}
                      legendType="none"
                      name={`${interpreter} — ${label}`}
                      isAnimationActive={false}
                      animationDuration={0}
                    />
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
                      className={[
                        "p-2 text-right",
                        m === currentMonth ? "bg-blue-100 dark:bg-blue-900/40" : "",
                      ].join(" ")}
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
                        className={[
                          "p-2 text-right",
                          m === currentMonth ? "bg-blue-50 dark:bg-blue-900/20 font-semibold" : "",
                        ].join(" ")}
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
                      className={[
                        "p-2 text-right",
                        m === currentMonth ? "bg-blue-50 dark:bg-blue-900/20 font-semibold" : "",
                      ].join(" ")}
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Month × Type × Interpreter (Year {activeYear})</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedMonth((prev) => prev ? "" : getCurrentCalendarMonth(months))}
              className="whitespace-nowrap"
            >
              {selectedMonth ? "Show all months" : "Show current month only"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="p-2 text-left sticky left-0 z-10 bg-white dark:bg-slate-950">
                    Month
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
                {monthsToRender.map((m) => {
                  const mrow = yearData.find((d) => d.month === m);
                  return TYPE_PRIORITY.map((label, idx) => {
                    const perItp = interpreters.map((itp) =>
                      label === "DR1" || label === "DR2" || label === "DRK" || label === "PDR" || label === "DR_OTHER"
                        ? getDRValue(mrow, itp, label)
                        : getMTValue(mrow, itp, label)
                    );
                    const total = perItp.reduce((a, b) => a + b, 0);
                    const diff = diffRange(perItp);

                    return (
                      <tr
                        key={`${m}-${label}`}
                        className={`hover:bg-muted/40 ${idx === groupSize - 1 ? "border-b-2 border-slate-200" : "border-b"}`}
                      >
                        {idx === 0 && (
                          <td
                            className="p-2 sticky left-0 z-10 bg-white dark:bg-slate-950 align-top font-medium"
                            rowSpan={groupSize}
                          >
                            {m}
                          </td>
                        )}
                        <td className="p-2">{label}</td>
                        {perItp.map((v, i) => (
                          <td key={i} className="p-2 text-right">
                            {v}
                          </td>
                        ))}
                        <td className={`p-2 text-right font-medium ${diffClass(diff)}`}>{diff}</td>
                        <td className="p-2 text-right font-semibold">{total}</td>
                      </tr>
                    );
                  });
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