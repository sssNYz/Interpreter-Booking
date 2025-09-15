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
import { Button } from "@/components/ui/button";
import { 
  diffClass,
  getCurrentCalendarMonth,
  diffRange
} from "@/utils/admin-dashboard";

/* =================== Labels & mapping =================== */
type PriorityLabel =
  | "DR1"
  | "DR2"
  | "DRK"
  | "VIP"
  | "PDR"
  | "WEEKLY"
  | "GENERAL"
  | "URGENT"
  | "OTHER"
  | "DR_OTHER";

const TYPE_PRIORITY: readonly PriorityLabel[] = [
  "DR1",
  "DR2",
  "DRK",
  "DR_OTHER",
  "VIP",
  "PDR",
  "WEEKLY",
  "GENERAL",
  "URGENT",
  "OTHER",
];

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

/* =================== Constants =================== */
const TYPE_COLORS = {
  dr1: "#ef4444",
  dr2: "#f97316",
  drk: "#eab308",
  pdr: "#84cc16",
  dr_other: "#22c55e",
  vip: "#3b82f6",
  weekly: "#6366f1",
  general: "#8b5cf6",
  urgent: "#a855f7",
  other: "#d946ef",
} as const;

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

/* =================== Component =================== */

interface TypesTabProps {
  year: number;
  data?: TypesApiResponse | null;
}

export function TypesTab({ year, data: externalData }: TypesTabProps) {
  // ---- hooks ----
  const [data, setData] = React.useState<TypesApiResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = React.useState<MonthName | "">("");
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);

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
  const typesMGIFooter: FooterByInterpreter = React.useMemo(() => 
    currentData?.typesMGIFooter ?? { perInterpreter: [], grand: 0, diff: 0 }, [currentData?.typesMGIFooter]);


  // current month for highlight
  const currentMonth = React.useMemo<MonthName | "">(
    () => (months.length ? getCurrentCalendarMonth(months) : ""),
    [months]
  );


  // ===== Chart dataset for interpreters with stacked meeting types =====
  const interpreterBarData = React.useMemo(() => {
    const data: Record<string, string | number>[] = [];
    
    months.forEach((month) => {
      const mrow = yearData.find((d) => d.month === month);
      
      // Create one data point per month with all interpreters
      const monthData: Record<string, string | number> = { month };
      
      interpreters.forEach((interpreter) => {
        const dr1 = getDRValue(mrow, interpreter, "DR1");
        const dr2 = getDRValue(mrow, interpreter, "DR2");
        const drk = getDRValue(mrow, interpreter, "DRK");
        const pdr = getDRValue(mrow, interpreter, "PDR");
        const dr_other = getDRValue(mrow, interpreter, "DR_OTHER");
        const vip = getMTValue(mrow, interpreter, "VIP");
        const weekly = getMTValue(mrow, interpreter, "WEEKLY");
        const general = getMTValue(mrow, interpreter, "GENERAL");
        const urgent = getMTValue(mrow, interpreter, "URGENT");
        const other = getMTValue(mrow, interpreter, "OTHER");
        
        // Add each interpreter's data with unique keys
        monthData[`${interpreter}_dr1`] = dr1;
        monthData[`${interpreter}_dr2`] = dr2;
        monthData[`${interpreter}_drk`] = drk;
        monthData[`${interpreter}_pdr`] = pdr;
        monthData[`${interpreter}_dr_other`] = dr_other;
        monthData[`${interpreter}_vip`] = vip;
        monthData[`${interpreter}_weekly`] = weekly;
        monthData[`${interpreter}_general`] = general;
        monthData[`${interpreter}_urgent`] = urgent;
        monthData[`${interpreter}_other`] = other;
      });
      
      data.push(monthData);
    });
    
    return data;
  }, [yearData, months, interpreters]);

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
  const monthsToRender: MonthName[] = showAllMonths
    ? months
    : (selectedMonth ? [selectedMonth] as MonthName[] : []);

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    if (showAllMonths) return typesMGIFooter;
    const mrow = yearData.find((d) => d.month === selectedMonth);
    const perInterpreter = interpreters.map((itp) =>
      TYPE_PRIORITY.reduce((sum, label) => {
        if (label === "DR1" || label === "DR2" || label === "DRK" || label === "PDR" || label === "DR_OTHER") {
          return sum + getDRValue(mrow, itp, label);
        }
        return sum + getMTValue(mrow, itp, label);
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [showAllMonths, typesMGIFooter, yearData, selectedMonth, interpreters]);


  return (
    <>
      {/* ===== Chart: Meeting Types by Month ===== */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">
            Meeting Types — All Months (Year {activeYear})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {interpreterBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interpreterBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                {interpreters.map((interpreter) => (
                  <React.Fragment key={interpreter}>
                    <Bar 
                      dataKey={`${interpreter}_dr1`} 
                      stackId={interpreter} 
                      name="DR1" 
                      fill={TYPE_COLORS.dr1}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_dr2`} 
                      stackId={interpreter} 
                      name="DR2" 
                      fill={TYPE_COLORS.dr2}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_drk`} 
                      stackId={interpreter} 
                      name="DRK" 
                      fill={TYPE_COLORS.drk}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_pdr`} 
                      stackId={interpreter} 
                      name="PDR" 
                      fill={TYPE_COLORS.pdr}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_dr_other`} 
                      stackId={interpreter} 
                      name="DR Other" 
                      fill={TYPE_COLORS.dr_other}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_vip`} 
                      stackId={interpreter} 
                      name="VIP" 
                      fill={TYPE_COLORS.vip}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_weekly`} 
                      stackId={interpreter} 
                      name="Weekly" 
                      fill={TYPE_COLORS.weekly}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_general`} 
                      stackId={interpreter} 
                      name="General" 
                      fill={TYPE_COLORS.general}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_urgent`} 
                      stackId={interpreter} 
                      name="Urgent" 
                      fill={TYPE_COLORS.urgent}
                      hide={true}
                    />
                    <Bar 
                      dataKey={`${interpreter}_other`} 
                      stackId={interpreter} 
                      name="Other" 
                      fill={TYPE_COLORS.other}
                      hide={true}
                    />
                    {/* Visible bars for actual rendering */}
                    <Bar 
                      dataKey={`${interpreter}_dr1`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.dr1}
                    />
                    <Bar 
                      dataKey={`${interpreter}_dr2`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.dr2}
                    />
                    <Bar 
                      dataKey={`${interpreter}_drk`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.drk}
                    />
                    <Bar 
                      dataKey={`${interpreter}_pdr`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.pdr}
                    />
                    <Bar 
                      dataKey={`${interpreter}_dr_other`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.dr_other}
                    />
                    <Bar 
                      dataKey={`${interpreter}_vip`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.vip}
                    />
                    <Bar 
                      dataKey={`${interpreter}_weekly`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.weekly}
                    />
                    <Bar 
                      dataKey={`${interpreter}_general`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.general}
                    />
                    <Bar 
                      dataKey={`${interpreter}_urgent`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.urgent}
                    />
                    <Bar 
                      dataKey={`${interpreter}_other`} 
                      stackId={interpreter} 
                      fill={TYPE_COLORS.other}
                    />
                  </React.Fragment>
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Month × Type × Interpreter (Year {activeYear})</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllMonths((v) => !v)}
              className="whitespace-nowrap"
            >
              {showAllMonths ? "Show current month only" : "Show all months"}
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
