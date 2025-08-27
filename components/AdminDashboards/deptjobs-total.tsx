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
import type { DashboardCtx, MonthName } from "@/types/overview";
import { OwnerGroupLabel as OGLabel } from "@/types/overview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type SingleMonthDeptBar = { group: string } & Record<string, number>;

/** หาเดือนปัจจุบันตามงบประมาณ (เม.ย.→มี.ค.) */
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

export function DeptTab({ ctx }: { ctx: DashboardCtx }) {
  const {
    activeYear,
    interpreters,
    departments,
    months,
    yearData,
    interpreterColors,
    diffClass,
    deptMGIFooter, // รวมทั้งปี (ใช้เมื่อโหมด "แสดงทั้งหมด")
  } = ctx;

  // ===== เลือกเดือนสำหรับกราฟ =====
  const [selectedMonth, setSelectedMonth] = React.useState<MonthName>(
    getCurrentFiscalMonth(months)
  );

  // ===== Toggle ตารางใหญ่: เริ่มต้นเป็น "เฉพาะเดือนปัจจุบัน" =====
  const [showAllMonths, setShowAllMonths] = React.useState<boolean>(false);

  // ===== dataset ของกราฟสำหรับเดือนที่เลือก =====
  const monthDeptData: SingleMonthDeptBar[] = React.useMemo(() => {
    const mrow = yearData.find((d) => d.month === selectedMonth);
    return departments.map((dept) => {
      const rec: SingleMonthDeptBar = { group: OGLabel[dept] };
      interpreters.forEach((itp) => {
        rec[itp] = mrow?.deptByInterpreter?.[itp]?.[dept] ?? 0;
      });
      return rec;
    });
  }, [yearData, selectedMonth, departments, interpreters]);

  // ===== ชุดเดือนที่จะ render ใน "ตารางใหญ่" (ตาม toggle) =====
  const monthsToRender: MonthName[] = showAllMonths ? months : [selectedMonth];

  // ===== คำนวณ footer ของตารางใหญ่แบบไดนามิก (ตามเดือนที่แสดงจริง) =====
  const dynamicFooter = React.useMemo(() => {
    if (showAllMonths) {
      // ใช้รวมทั้งปีที่มีอยู่เดิม
      return deptMGIFooter;
    }
    const perInterpreter = interpreters.map((itp) =>
      monthsToRender.reduce((acc, m) => {
        const r = yearData.find((d) => d.month === m);
        // รวมทุกแผนกของล่าม itp ภายในเดือน m
        const sumThisMonth = departments.reduce(
          (s, dept) => s + (r?.deptByInterpreter?.[itp]?.[dept] ?? 0),
          0
        );
        return acc + sumThisMonth;
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff =
      perInterpreter.length > 0
        ? Math.max(...perInterpreter) - Math.min(...perInterpreter)
        : 0;
    return { perInterpreter, grand, diff };
  }, [showAllMonths, deptMGIFooter, interpreters, monthsToRender, yearData, departments]);

  return (
    <>
      {/* ===== Chart: one month only with dropdown ===== */}
      <Card className="h-[380px] mb-4">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Meetings by Department — Month {selectedMonth} (Year {activeYear})
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
                data={monthDeptData}
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              >
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
          </div>
        </CardContent>
      </Card>

      {/* ===== Table A: Group × Months (เหมือนเดิม) ===== */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            DEDE Group Booking (Group / Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="p-2 text-left">Group</th>
                  {months.map((m) => (
                    <th key={m} className="p-2 text-right">
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => {
                  type GroupRow = {
                    department: string;
                    TOTAL: number;
                  } & Record<MonthName, number>;
                  const row = months.reduce(
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
                    <tr
                      key={dept}
                      className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40"
                    >
                      <td className="p-2">{row.department}</td>
                      {months.map((m) => (
                        <td key={m} className="p-2 text-right">
                          {row[m]}
                        </td>
                      ))}
                      <td className="p-2 text-right font-semibold">
                        {row.TOTAL}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 font-semibold">
                  <td className="p-2">Total</td>
                  {months.map((m) => {
                    const col = departments.reduce(
                      (a, dept) =>
                        a +
                        (yearData.find((d) => d.month === m)?.deptMeetings?.[
                          dept
                        ] || 0),
                      0
                    );
                    return (
                      <td key={m} className="p-2 text-right">
                        {col}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right">
                    {departments.reduce(
                      (a, dept) =>
                        a +
                        months.reduce(
                          (x, m) =>
                            x +
                            (yearData.find((d) => d.month === m)
                              ?.deptMeetings?.[dept] || 0),
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

      {/* ===== Table B: Month × Group × Interpreter (series + toggle) ===== */}
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
                    <th key={p} className="p-2 text-right">
                      {p}
                    </th>
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
                      const vals = interpreters.map(
                        (p) => r?.deptByInterpreter?.[p]?.[dept] ?? 0
                      );
                      const total = vals.reduce((a, b) => a + b, 0);
                      const d = ctx.diffRange(vals);

                      return (
                        <tr
                          key={`${m}-${dept}`}
                          className="border-b odd:bg-white even:bg-muted/30 hover:bg-muted/40"
                        >
                          {/* แสดงชื่อเดือนแค่ครั้งเดียวต่อเดือน */}
                          {idx === 0 && (
                            <td
                              className="p-2 align-top font-medium"
                              rowSpan={departments.length}
                            >
                              {m}
                            </td>
                          )}
                          <td className="p-2">{OGLabel[dept]}</td>
                          {interpreters.map((p, i) => (
                            <td key={p} className="p-2 text-right">
                              {vals[i]}
                            </td>
                          ))}
                          <td
                            className={`p-2 text-right font-medium ${diffClass(
                              d
                            )}`}
                          >
                            {d}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {total}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
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
                    className={`p-2 text-right ${diffClass(dynamicFooter.diff)}`}
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
