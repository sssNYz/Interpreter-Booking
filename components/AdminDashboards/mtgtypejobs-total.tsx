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
  DashboardCtx,
  MeetingType,
  TypesTableRow,
  MonthName,
} from "@/types/overview";
import type { DRType } from "@/types/overview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/** Required display order on charts & tables */
type PriorityLabel =
  | "DR1"
  | "DR2"
  | "DRK"
  | "VIP"
  | "PR"
  | "WEEKLY"
  | "GENERAL"
  | "URGENT"
  | "OTHER";
const TYPE_PRIORITY: readonly PriorityLabel[] = [
  "DR1",
  "DR2",
  "DRK",
  "VIP",
  "PR",
  "WEEKLY",
  "GENERAL",
  "URGENT",
  "OTHER",
];

/** Map labels to MeetingType/DRType keys */
const DR_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "DR1" | "DR2" | "DRK" | "PR">,
  DRType
> = {
  DR1: "DR_I",
  DR2: "DR_II",
  DRK: "DR_k",
  PR: "PR_PR",
};
const MT_LABEL_TO_KEY: Record<
  Extract<PriorityLabel, "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "OTHER">,
  MeetingType
> = {
  VIP: "VIP",
  WEEKLY: "Weekly",
  GENERAL: "General",
  URGENT: "Augent", // schema uses "Augent"
  OTHER: "Other",
};

/** Fiscal-month helper (Apr→Mar) */
function getCurrentFiscalMonth(months: MonthName[]): MonthName {
  const map: Record<number, number> = {
    0: 9,
    1: 10,
    2: 11,
    3: 0,
    4: 1,
    5: 2,
    6: 3,
    7: 4,
    8: 5,
    9: 6,
    10: 7,
    11: 8,
  };
  return months[map[new Date().getMonth()]] ?? months[0];
}

/** Value resolvers */
function getDRValue(
  mrow: DashboardCtx["yearData"][number] | undefined,
  itp: string,
  label: "DR1" | "DR2" | "DRK" | "PR"
): number {
  const key = DR_LABEL_TO_KEY[label];
  // expects `drTypeByInterpreter` to exist on MonthlyDataRow (added in shared types)
  return (mrow as any)?.drTypeByInterpreter?.[itp]?.[key] ?? 0;
}
function getMTValue(
  mrow: DashboardCtx["yearData"][number] | undefined,
  itp: string,
  label: "VIP" | "WEEKLY" | "GENERAL" | "URGENT" | "OTHER"
): number {
  const key = MT_LABEL_TO_KEY[label];
  return mrow?.typeByInterpreter?.[itp]?.[key] ?? 0;
}

type SingleMonthBar = { type: PriorityLabel } & Record<string, number>;

export function TypesTab({ ctx }: { ctx: DashboardCtx }) {
  const {
    activeYear,
    interpreters,
    months,
    interpreterColors,
    diffClass,
    diffRange,
    yearData,
    typesMGIFooter, // full-year footer (used when toggled to "all months")
  } = ctx;

  const [selectedMonth, setSelectedMonth] = React.useState<MonthName>(
    getCurrentFiscalMonth(months)
  );

  /** Toggle for the big table: default shows only current month; click to show all months */
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);

  /* ===== Chart dataset (single month, fixed order) ===== */
  const monthBarData: SingleMonthBar[] = React.useMemo(() => {
    const mrow = yearData.find((d) => d.month === selectedMonth);
    return TYPE_PRIORITY.map((label) => {
      const rec: SingleMonthBar = { type: label };
      interpreters.forEach((itp) => {
        let v = 0;
        if (
          label === "DR1" ||
          label === "DR2" ||
          label === "DRK" ||
          label === "PR"
        ) {
          v = getDRValue(mrow, itp, label);
        } else {
          v = getMTValue(mrow, itp, label);
        }
        rec[itp] = v;
      });
      return rec;
    });
  }, [yearData, selectedMonth, interpreters]);

  /* ===== Table 1: Types × Months (All interpreters), fixed order ===== */
  const tableAllMonthsRows = React.useMemo<TypesTableRow<MonthName>[]>(() => {
    return TYPE_PRIORITY.map((label) => {
      const row: Record<string, number | string> = { type: label, TOTAL: 0 };
      months.forEach((m) => {
        const mrow = yearData.find((d) => d.month === m);
        const v = interpreters.reduce((sum, itp) => {
          if (
            label === "DR1" ||
            label === "DR2" ||
            label === "DRK" ||
            label === "PR"
          ) {
            return sum + getDRValue(mrow, itp, label);
          }
          return sum + getMTValue(mrow, itp, label);
        }, 0);
        row[m] = v;
      });
      row.TOTAL = months.reduce((a, m) => a + (row[m] as number), 0);
      return row as TypesTableRow<MonthName>;
    });
  }, [months, yearData, interpreters]);

  const tableAllMonthsFooter = React.useMemo(() => {
    const perMonth = months.map((m) =>
      tableAllMonthsRows.reduce((sum, r) => sum + (r[m] as number), 0)
    );
    const grand = perMonth.reduce((a, b) => a + b, 0);
    return { perMonth, grand };
  }, [months, tableAllMonthsRows]);

  /* ===== Table 2: Month × Type × Interpreter, fixed order + rowSpan per month ===== */
  const groupSize = TYPE_PRIORITY.length;

  // Months to render according to toggle
  const monthsToRender: MonthName[] = showAllMonths ? months : [selectedMonth];

  // Dynamic footer (respects toggle)
  const dynamicFooter = React.useMemo(() => {
    if (showAllMonths) return typesMGIFooter;

    const mrow = yearData.find((d) => d.month === selectedMonth);
    const perInterpreter = interpreters.map((itp) =>
      TYPE_PRIORITY.reduce((sum, label) => {
        if (label === "DR1" || label === "DR2" || label === "DRK" || label === "PR")
          return sum + getDRValue(mrow, itp, label);
        return sum + getMTValue(mrow, itp, label);
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff =
      perInterpreter.length > 0
        ? Math.max(...perInterpreter) - Math.min(...perInterpreter)
        : 0;
    return { perInterpreter, grand, diff };
  }, [showAllMonths, typesMGIFooter, yearData, selectedMonth, interpreters]);

  return (
    <>
      {/* ===== Chart: single month, fits the card, fixed order ===== */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Meeting Types — Month {selectedMonth} (Year {activeYear})
            </CardTitle>
            <Select
              value={selectedMonth}
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
          <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthBarData}
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                {interpreters.map((p) => (
                  <Bar key={p} dataKey={p} name={p} fill={interpreterColors[p]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===== Types × Months (All interpreters) — fixed priority order ===== */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            Types × Months (All interpreters)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="p-2 text-left">Type</th>
                  {months.map((m) => (
                    <th key={m} className="p-2 text-right">
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {tableAllMonthsRows.map((row) => (
                  <tr
                    key={row.type}
                    className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40"
                  >
                    <td className="p-2">{row.type}</td>
                    {months.map((m) => (
                      <td key={m} className="p-2 text-right">
                        {row[m]}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold">{row.TOTAL}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-semibold">
                  <td className="p-2">Total</td>
                  {months.map((m, idx) => (
                    <td key={m} className="p-2 text-right">
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

      {/* ===== Month × Type × Interpreter — rowSpan + TOGGLE ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Month × Type × Interpreter (Year {activeYear})
            </CardTitle>
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
                {(showAllMonths ? months : [selectedMonth]).map((m) => {
                  const mrow = yearData.find((d) => d.month === m);
                  return TYPE_PRIORITY.map((label, idx) => {
                    const perItp = interpreters.map((itp) =>
                      label === "DR1" ||
                      label === "DR2" ||
                      label === "DRK" ||
                      label === "PR"
                        ? getDRValue(mrow, itp, label)
                        : getMTValue(mrow, itp, label)
                    );
                    const total = perItp.reduce((a, b) => a + b, 0);
                    const diff = diffRange(perItp);

                    return (
                      <tr
                        key={`${m}-${label}`}
                        className={`hover:bg-muted/40 ${
                          idx === groupSize - 1
                            ? "border-b-2 border-slate-200"
                            : "border-b"
                        }`}
                      >
                        {/* show month name once per group */}
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
                        <td
                          className={`p-2 text-right font-medium ${diffClass(
                            diff
                          )}`}
                        >
                          {diff}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {total}
                        </td>
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
                  <td
                    className={`p-2 text-right ${diffClass(
                      dynamicFooter.diff
                    )}`}
                  >
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
