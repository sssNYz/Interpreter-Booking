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
  MonthlyDataRow,
  FooterByInterpreter,
  InterpreterName,
  OwnerGroup,
  DepartmentsApiResponse,
  CategoryChartRow,
} from "@/types/admin-dashboard";
import { OwnerGroupLabel as OGLabel } from "@/types/admin-dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { 
  getCurrentCalendarMonth, 
  diffRange, 
  diffClass,
  createInterpreterColorPalette 
} from "@/utils/admin-dashboard";

/* ========= Types ========= */
type SingleMonthDeptBar = CategoryChartRow & Record<InterpreterName, number>;

/* ========= Component ========= */

interface DeptTabProps {
  year: number;
  data?: DepartmentsApiResponse | null;
}

export function DeptTab({ year, data: externalData }: DeptTabProps) {
  const [data, setData] = React.useState<DepartmentsApiResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = React.useState<MonthName | "">("");
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);

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
            setSelectedMonth((prev) => (prev ? prev : getCurrentCalendarMonth(j.months)));
          }
        })
        .catch((e) => {
          if (alive) console.error("Error fetching dept data:", e);
        });

      return () => { alive = false; };
    } else if (externalData) {
      setSelectedMonth((prev) => (prev ? prev : getCurrentCalendarMonth(externalData.months)));
    }
  }, [year, externalData]);

  // Data from API or fallback
  const activeYear = React.useMemo(() => currentData?.year ?? year, [currentData?.year, year]);
  const months: MonthName[] = React.useMemo(() => currentData?.months ?? [], [currentData?.months]);
  const interpreters: InterpreterName[] = React.useMemo(() => currentData?.interpreters ?? [], [currentData?.interpreters]);
  const departments: OwnerGroup[] = React.useMemo(() => currentData?.departments ?? [], [currentData?.departments]);
  const yearData: MonthlyDataRow[] = React.useMemo(() => currentData?.yearData ?? [], [currentData?.yearData]);
  const deptMGIFooter: FooterByInterpreter = React.useMemo(
    () => currentData?.deptMGIFooter ?? { perInterpreter: [], grand: 0, diff: 0 },
    [currentData?.deptMGIFooter]
  );

  // present month
  const currentMonth = React.useMemo<MonthName | "">(
    () => (months.length ? getCurrentCalendarMonth(months) : ""),
    [months]
  );

  const interpreterColors = React.useMemo<Record<InterpreterName, string>>(() => {
    return createInterpreterColorPalette(interpreters);
  }, [interpreters]);

  const monthDeptData: SingleMonthDeptBar[] = React.useMemo(() => {
    if (!selectedMonth) return [];
    const mrow = yearData.find((d) => d.month === selectedMonth);
    return departments.map((dept) => {
      const rec: SingleMonthDeptBar = { group: OGLabel[dept] } as SingleMonthDeptBar;
      interpreters.forEach((itp) => {
        rec[itp] = mrow?.deptByInterpreter?.[itp]?.[dept] ?? 0;
      });
      return rec;
    });
  }, [yearData, selectedMonth, departments, interpreters]);

  const monthsToRender: MonthName[] = React.useMemo(
    () => showAllMonths ? months : (selectedMonth ? [selectedMonth] : []),
    [showAllMonths, months, selectedMonth]
  );

  const dynamicFooter = React.useMemo<FooterByInterpreter>(() => {
    if (showAllMonths) return deptMGIFooter;
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
  }, [showAllMonths, deptMGIFooter, interpreters, monthsToRender, yearData, departments]);

  return (
    <>
      {/* Chart select month */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Meetings by Department — Month {selectedMonth || "-"} (Year {activeYear})
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
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthDeptData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip />
              <Legend />
              {interpreters.map((p) => (
                <Bar key={p} dataKey={p} name={p} fill={interpreterColors[p]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
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
                      className={[
                        "p-2 text-right",
                        // highlight current month column in thead
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
                          className={[
                            "p-2 text-right",
                            // highlight current month column in tbody
                            m === currentMonth ? "bg-blue-50 dark:bg-blue-900/20 font-semibold" : "",
                          ].join(" ")}
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
                        className={[
                          "p-2 text-right",
                          // highlight current month column in tfoot
                          m === currentMonth ? "bg-blue-50 dark:bg-blue-900/20 font-semibold" : "",
                        ].join(" ")}
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Month × Group × Interpreter (Year {activeYear})
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
                  <th className="p-2 text-left">Month</th>
                  <th className="p-2 text-left">Group</th>
                  {interpreters.map((p) => (
                    <th key={p} className="p-2 text-right">{p}</th>
                  ))}
                  <th className="p-2 text-right">Diff</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthsToRender.map((m) => (
                  <React.Fragment key={m}>
                    {departments.map((dept, idx) => {
                      const r = yearData.find((d) => d.month === m);
                      const vals = interpreters.map((p) => r?.deptByInterpreter?.[p]?.[dept] ?? 0);
                      const total = vals.reduce((a, b) => a + b, 0);
                      const d = diffRange(vals);

                      return (
                        <tr key={`${m}-${dept}`} className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40">
                          {idx === 0 && (
                            <td className="p-2 align-top font-medium" rowSpan={departments.length}>
                              {m}
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
                  </React.Fragment>
                ))}
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
