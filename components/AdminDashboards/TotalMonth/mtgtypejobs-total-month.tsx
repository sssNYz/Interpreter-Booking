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
  TypeChartRow,
  MonthlyTableRow,
} from "@/types/admin-dashboard";
import { Button } from "@/components/ui/button";
import { 
  diffClass,
  createInterpreterColorPalette,
  getCurrentCalendarMonth,
  diffRange 
} from "@/utils/admin-dashboard";

/* =================== Custom Components =================== */
const TypesTooltip = React.memo(function TypesTooltip({
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

/* =================== Labels & mapping =================== */
type PriorityLabel =
  | "DR1"
  | "DR2"
  | "DRK"
  | "VIP"
  | "DR_PR"
  | "WEEKLY"
  | "GENERAL"
  | "URGENT"
  | "PRESIDENT"
  | "OTHER"
  | "DR_OTHER";

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
type SingleMonthBar = TypeChartRow & { type: PriorityLabel } & Record<string, number>;

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
  label: "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "PRESIDENT" | "OTHER"
): number {
  const key = MT_LABEL_TO_KEY[label];
  return mrow?.typeByInterpreter?.[itp]?.[key] ?? 0;
}

/* =================== Component =================== */

interface TypesTabProps {
  year: number;
  data?: TypesApiResponse | null;
  selectedMonth?: string;
}

export function TypesTab({ year, data: externalData, selectedMonth: propSelectedMonth }: TypesTabProps) {
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
  const typesMGIFooter: FooterByInterpreter = React.useMemo(() => 
    currentData?.typesMGIFooter ?? { perInterpreter: [], grand: 0, diff: 0 }, [currentData?.typesMGIFooter]);

  // current month for highlight
  const currentMonth = React.useMemo<MonthName | "">(
    () => (months.length ? getCurrentCalendarMonth(months) : ""),
    [months]
  );

  // color palette
  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    return createInterpreterColorPalette(interpreters);
  }, [interpreters]);

  // ===== Chart dataset  =====
  const monthBarData: SingleMonthBar[] = React.useMemo(() => {
    const selectedMonth = propSelectedMonth || (months.length > 0 ? months[0] : "");
    if (!selectedMonth) return [];
    const mrow = yearData.find((d) => d.month === selectedMonth);
    return TYPE_PRIORITY.map((label) => {
      const rec = { type: label } as SingleMonthBar;
      interpreters.forEach((itp) => {
        let v = 0;
        if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
          v = getDRValue(mrow, itp, label);
        } else {
          v = getMTValue(mrow, itp, label);
        }
        rec[itp] = v;
      });
      return rec;
    });
  }, [yearData, propSelectedMonth, months, interpreters]);

  const yMax = React.useMemo(() => {
    let max = 0;
    for (const row of monthBarData) {
      for (const itp of interpreters) {
        const v = Number((row as Record<string, number>)[itp] ?? 0);
        if (v > max) max = v;
      }
    }
    return max;
  }, [monthBarData, interpreters]);

  const yTicks = React.useMemo(() => {
    const top = Math.ceil(yMax / 2) * 2;
    const arr: number[] = [];
    for (let v = 0; v <= top; v += 2) arr.push(v);
    return arr.length ? arr : [0, 2];
  }, [yMax]);

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
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
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
  const selectedMonth = propSelectedMonth || (months.length > 0 ? months[0] : "");
  const monthsToRender: MonthName[] = selectedMonth ? [selectedMonth] as MonthName[] : [];

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    const mrow = yearData.find((d) => d.month === selectedMonth);
    const perInterpreter = interpreters.map((itp) =>
      TYPE_PRIORITY.reduce((sum, label) => {
          if (label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER") {
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
      {/* ===== Chart: one month with dropdown ===== */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Meeting Types — Month {selectedMonth || "-"} (Year {activeYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthBarData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yTicks[yTicks.length - 1] ?? 0]}
                  ticks={yTicks}
                  tickFormatter={(v) => v.toString()}
                />
                <Tooltip
                  content={<TypesTooltip />}
                  offset={12}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  filterNull
                />
                <Legend />
                {interpreters.map((p) => (
                  <Bar key={p} dataKey={p} name={p} fill={interpreterColors[p]} />
                ))}
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

      {/* ===== Table 2: Month × Type × Interpreter (unchanged) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Month × Type × Interpreter (Year {activeYear})</CardTitle>
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
                      label === "DR1" || label === "DR2" || label === "DRK" || label === "DR_PR" || label === "DR_OTHER"
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
