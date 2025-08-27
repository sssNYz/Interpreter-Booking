"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Clock, BarChart2 } from "lucide-react";

import { JobsTab } from "@/components/AdminDashboards/jobs-total";
import { HoursTab } from "@/components/AdminDashboards/timejobs-total";
import { DeptTab } from "@/components/AdminDashboards/deptjobs-total";
import { TypesTab } from "@/components/AdminDashboards/mtgtypejobs-total";

import type {
  DashboardCtx,
  OwnerGroup,
  MeetingType,
  InterpreterName,
  MonthName,
  MonthlyDataRow,
  JobsRow,
  HoursRow,
  DeptBarsRow,
  TypesBarsRow,
  TypesTableRow,
} from "@/types/overview";
import { OwnerGroupLabel as OGLabel } from "@/types/overview";

/* ---------------- Theme wrapper (match Booking page) ---------------- */
const PAGE_WRAPPER = "min-h-screen bg-[#f7f7f7] font-sans text-gray-900";

/* ---------------- Utilities & mini UI ---------------- */
function sumValues(obj: Record<string, number>) {
  return Object.values(obj).reduce((a: number, b: number) => a + (b || 0), 0);
}
const diffClass = (v: number) => (v < 0 ? "text-red-600" : v > 0 ? "text-emerald-600" : "text-muted-foreground");
const diffRange = (values: number[]) => {
  if (!values.length) return 0;
  let mn = Number.POSITIVE_INFINITY,
    mx = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    const n = Number(v) || 0;
    mn = Math.min(mn, n);
    mx = Math.max(mx, n);
  }
  return mx - mn;
};

const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-xl bg-muted">
      <Icon size={18} />
    </div>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  </div>
);

// minutes -> "H.MM hr" or "N min"
function formatMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return "0 min";
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}.${String(m).padStart(2, "0")} hr` : `${sign}${abs} min`;
}

const getCurrentFiscalMonthLabel = (now = new Date()): MonthName => {
  const mths: MonthName[] = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const map: Record<number, number> = { 0: 9, 1: 10, 2: 11, 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8 };
  return mths[map[now.getMonth()]];
};

/* ---------------- Mock data (aligned with Prisma enums) ---------------- */
const years: number[] = [2025];
const months: MonthName[] = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const interpreters: InterpreterName[] = ["Kiaotchitra", "Pitchaporn"];
const departments: OwnerGroup[] = ["hardware", "software", "iot", "other"];

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#dc2626"];
const interpreterColors: Record<InterpreterName, string> = Object.fromEntries(
  interpreters.map((n, i) => [n, palette[i % palette.length]])
) as Record<InterpreterName, string>;

const TYPE_OTHER_KEY = "Other";
const typeLimit = 8;

// month rows -> include jobsByInterpreter, hoursByInterpreter, deptMeetings, deptByInterpreter, typeByInterpreter (Prisma MeetingType keys)
const sampleMonthlyData: MonthlyDataRow[] = months.map((m, i) => {
  const year = 2025;
  const jobsByInterpreter: Record<InterpreterName, number> = {
    Kiaotchitra: [8, 7, 5, 21, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
    Pitchaporn: [7, 5, 5, 19, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
  };
  const hoursByInterpreter: Record<InterpreterName, number> = {
    Kiaotchitra: [15, 12, 10, 40, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
    Pitchaporn: [14, 11, 9, 38, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
  };
  const deptMeetings: Record<OwnerGroup, number> = {
    hardware: [15, 12, 10, 40, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
    software: [5, 4, 2, 50, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
    iot: [2, 3, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
    other: [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0][i] ?? 0,
  };
  const deptByInterpreter: Record<InterpreterName, Record<OwnerGroup, number>> = {
    Kiaotchitra: { hardware: [8, 7, 5, 21][i] ?? 0, software: [4, 2, 0, 23][i] ?? 0, iot: [0, 0, 0, 16][i] ?? 0, other: [0, 0, 0, 2][i] ?? 0 },
    Pitchaporn: { hardware: [7, 5, 5, 19][i] ?? 0, software: [1, 2, 0, 27][i] ?? 0, iot: [2, 3, 0, 16][i] ?? 0, other: [0, 0, 0, 2][i] ?? 0 },
  };
  const typeByInterpreter: Record<InterpreterName, Record<MeetingType, number>> = {
    Kiaotchitra: { DR: [2, 2, 1, 3][i] ?? 0, VIP: [1, 1, 1, 2][i] ?? 0, Weekly: [2, 1, 1, 2][i] ?? 0, General: [3, 2, 1, 5][i] ?? 0, Augent: [1, 1, 0, 1][i] ?? 0, Other: [1, 0, 0, 1][i] ?? 0 },
    Pitchaporn: { DR: [2, 1, 1, 4][i] ?? 0, VIP: [1, 1, 1, 1][i] ?? 0, Weekly: [1, 1, 1, 2][i] ?? 0, General: [2, 2, 1, 6][i] ?? 0, Augent: [1, 1, 0, 1][i] ?? 0, Other: [0, 0, 0, 1][i] ?? 0 },
  };
  return { year, month: m, jobsByInterpreter, hoursByInterpreter, deptMeetings, deptByInterpreter, typeByInterpreter };
});

/* ---------------- Main component ---------------- */
export default function Page() {
  const [activeYear, setActiveYear] = useState<number>(years[0]);
  const [agg, setAgg] = useState<"month" | "year">("month");
  const currentMonthLabel = getCurrentFiscalMonthLabel();

  // year filter
  const yearData = useMemo<MonthlyDataRow[]>(() => sampleMonthlyData.filter((d) => d.year === activeYear), [activeYear]);

  // collect types present in this year
  const typesList = useMemo<MeetingType[]>(() => {
    const set = new Set<MeetingType>();
    yearData.forEach((row) => {
      (Object.values(row.typeByInterpreter) as Array<Record<MeetingType, number>>).forEach((obj) => {
        (Object.keys(obj) as MeetingType[]).forEach((k) => set.add(k));
      });
    });
    return Array.from(set);
  }, [yearData]);

  // KPI
  const kpiMonthData = useMemo(() => yearData.find((d) => d.month === currentMonthLabel), [yearData, currentMonthLabel]);
  const kpiMonth = {
    jobs: kpiMonthData ? sumValues(kpiMonthData.jobsByInterpreter) : 0,
    hours: kpiMonthData ? sumValues(kpiMonthData.hoursByInterpreter) : 0,
    dept: kpiMonthData ? sumValues(kpiMonthData.deptMeetings) : 0,
  };
  const kpiYearJobs = useMemo(() => yearData.reduce((a, r) => a + sumValues(r.jobsByInterpreter), 0), [yearData]);
  const kpiYearHours = useMemo(() => yearData.reduce((a, r) => a + sumValues(r.hoursByInterpreter), 0), [yearData]);
  const kpiYearDept = useMemo(() => yearData.reduce((a, r) => a + sumValues(r.deptMeetings), 0), [yearData]);
  const kpiJobs = agg === "year" ? kpiYearJobs : kpiMonth.jobs;
  const kpiHours = agg === "year" ? kpiYearHours : kpiMonth.hours;
  const kpiDept = agg === "year" ? kpiYearDept : kpiMonth.dept;

  // Datasets
  const totalJobsStack = useMemo<JobsRow[]>(
    () =>
      yearData.map((row) => {
        const base: Record<string, number | string> = { month: row.month, total: sumValues(row.jobsByInterpreter) };
        Object.entries(row.jobsByInterpreter).forEach(([k, v]) => {
          base[k] = v;
        });
        return base as JobsRow;
      }),
    [yearData]
  );

  const totalHoursLineMinutes = useMemo<HoursRow[]>(
    () =>
      yearData.map((row) => {
        const base: Record<string, number | string> = { month: row.month, total: sumValues(row.hoursByInterpreter) * 60 };
        interpreters.forEach((itp) => {
          base[itp] = (row.hoursByInterpreter[itp] || 0) * 60;
        });
        return base as HoursRow;
      }),
    [yearData]
  );

  // footers
  const jobsFooter = useMemo(() => {
    const perInterpreter = interpreters.map((itp) =>
      months.reduce((acc, m) => acc + (yearData.find((d) => d.month === m)?.jobsByInterpreter?.[itp] || 0), 0)
    );
    return { perInterpreter, grand: perInterpreter.reduce((a, b) => a + b, 0), diff: diffRange(perInterpreter) };
  }, [yearData]);

  const hoursFooter = useMemo(() => {
    const perInterpreter = interpreters.map((itp) =>
      months.reduce((acc, m) => acc + (yearData.find((d) => d.month === m)?.hoursByInterpreter?.[itp] || 0), 0)
    );
    return { perInterpreter, grand: perInterpreter.reduce((a, b) => a + b, 0), diff: diffRange(perInterpreter) };
  }, [yearData]);

  // ===== Dept grouped bars (Month x Department) =====
  const deptBarsFlat = useMemo<DeptBarsRow[]>(() => {
    const rows: DeptBarsRow[] = [];
    months.forEach((m) => {
      const r = yearData.find((d) => d.month === m);
      departments.forEach((dept) => {
        const base: Record<string, number | string> = { month: m, group: OGLabel[dept] };
        interpreters.forEach((itp) => {
          base[itp] = r?.deptByInterpreter?.[itp]?.[dept] || 0;
        });
        rows.push(base as DeptBarsRow);
      });
    });
    return rows;
  }, [yearData]);

  const deptMGIFooter = useMemo(() => {
    const perInterpreter = interpreters.map((itp) =>
      months.reduce((acc, m) => {
        const r = yearData.find((d) => d.month === m);
        return acc + departments.reduce((s, dept) => s + (r?.deptByInterpreter?.[itp]?.[dept] || 0), 0);
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [yearData]);

  // ===== Types grouped bars (Month x Type), Top8+Other supported =====
  const typesSorted = useMemo(() => {
    const totals: Record<string, number> = {};
    typesList.forEach((t) => {
      const sumForType = months.reduce((sum, m) => {
        const monthRow = yearData.find((d) => d.month === m);
        const byInterpreters = interpreters.reduce(
          (acc, itp) => acc + (monthRow?.typeByInterpreter?.[itp]?.[t] ?? 0),
          0
        );
        return sum + byInterpreters;
      }, 0);
      totals[t] = sumForType;
    });
    return [...typesList].sort((a, b) => totals[b] - totals[a]);
  }, [typesList, yearData]);

  const hasOverflowTypes = typesSorted.length > typeLimit;
  const displayList = (hasOverflowTypes ? typesSorted.slice(0, typeLimit) : typesSorted) as string[];
  const listForBars = hasOverflowTypes ? [...displayList, TYPE_OTHER_KEY] : displayList;

  const typesBarsFlat = useMemo<TypesBarsRow[]>(() => {
    const rows: TypesBarsRow[] = [];
    months.forEach((m) => {
      const monthRow = yearData.find((d) => d.month === m);
      listForBars.forEach((t) => {
        const base: Record<string, number | string> = { month: m, type: t };
        interpreters.forEach((itp) => {
          if (t === TYPE_OTHER_KEY && hasOverflowTypes) {
            const otherSum = typesSorted.slice(typeLimit).reduce((s, tt) => s + (monthRow?.typeByInterpreter?.[itp]?.[tt as MeetingType] || 0), 0);
            base[itp] = otherSum;
          } else {
            base[itp] = monthRow?.typeByInterpreter?.[itp]?.[t as MeetingType] || 0;
          }
        });
        rows.push(base as TypesBarsRow);
      });
    });
    return rows;
  }, [yearData, listForBars, hasOverflowTypes, typesSorted]);

  // Types tables
  const typesTableA_Rows = useMemo<TypesTableRow<MonthName>[]>(() => {
    const rows: TypesTableRow<MonthName>[] = [];
    listForBars.forEach((t) => {
      const rowBase: Record<string, number | string> = { type: t, TOTAL: 0 };
      months.forEach((m) => {
        const monthRow = yearData.find((d) => d.month === m);
        const value =
          t === TYPE_OTHER_KEY && hasOverflowTypes
            ? typesSorted
                .slice(typeLimit)
                .reduce(
                  (s, tt) =>
                    s + interpreters.reduce((a, itp) => a + (monthRow?.typeByInterpreter?.[itp]?.[tt as MeetingType] || 0), 0),
                  0
                )
            : interpreters.reduce((a, itp) => a + (monthRow?.typeByInterpreter?.[itp]?.[t as MeetingType] || 0), 0);
        rowBase[m] = value;
      });
      rowBase.TOTAL = months.reduce((a, m) => a + (rowBase[m] as number), 0);
      rows.push(rowBase as TypesTableRow<MonthName>);
    });
    return rows;
  }, [yearData, listForBars, hasOverflowTypes, typesSorted]);

  const typesTableA_Footer = useMemo(() => {
    const perMonth = months.map((m) => {
      const monthRow = yearData.find((d) => d.month === m);
      return typesSorted.reduce(
        (s, t) => s + interpreters.reduce((a, itp) => a + (monthRow?.typeByInterpreter?.[itp]?.[t] || 0), 0),
        0
      );
    });
    const grand = perMonth.reduce((a, b) => a + b, 0);
    return { perMonth, grand };
  }, [yearData, typesSorted]);

  const typesMGIFooter = useMemo(() => {
    const perInterpreter = interpreters.map((itp) =>
      months.reduce((acc, m) => {
        const monthRow = yearData.find((d) => d.month === m);
        return acc + typesSorted.reduce((s, t) => s + (monthRow?.typeByInterpreter?.[itp]?.[t] || 0), 0);
      }, 0)
    );
    const grand = perInterpreter.reduce((a, b) => a + b, 0);
    const diff = diffRange(perInterpreter);
    return { perInterpreter, grand, diff };
  }, [yearData, typesSorted]);

  // dynamic widths for scrollable grouped charts
  const BAND_PX = 90;
  const deptChartWidthPx = useMemo(() => Math.max(months.length * departments.length * BAND_PX, 900), []);
  const visibleTypesCount = hasOverflowTypes ? displayList.length + 1 : displayList.length;
  const typesChartWidthPx = useMemo(() => Math.max(months.length * visibleTypesCount * BAND_PX, 900), [visibleTypesCount]);

  // year options
  const yearOptions = years.map((y) => (
    <SelectItem key={y} value={String(y)}>
      {y}
    </SelectItem>
  ));

  // context for child tabs
  const ctx: DashboardCtx = {
    activeYear,
    interpreters,
    months,
    departments,
    totalJobsStack,
    jobsFooter,
    totalHoursLineMinutes,
    hoursFooter,
    formatMinutes,
    deptBarsFlat,
    deptChartWidthPx,
    deptMGIFooter,
    typesBarsFlat,
    typesChartWidthPx,
    typesTableA_Rows,
    typesTableA_Footer,
    typesMGIFooter,
    displayTypes: displayList,
    hasOverflowTypes,
    typesSorted,
    typeLimit,
    interpreterColors,
    diffClass,
    diffRange,
    yearData,
  };

  return (
    <div className={PAGE_WRAPPER}>
      {/* Top Header (same style as Booking page) */}
      <div className="border-b bg-white border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-900 text-white rounded-full p-2">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Analytics Overview</h1>
                <p className="text-sm text-gray-500">Monthly jobs, time, departments, and meeting types</p>
              </div>
            </div>
            {/* Controls (Year + Month/Year) — desktop */}
            <div className="hidden md:flex items-center gap-3">
              <Select value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>{yearOptions}</SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button size="sm" variant={agg === "month" ? "default" : "outline"} onClick={() => setAgg("month")}>
                  Month
                </Button>
                <Button size="sm" variant={agg === "year" ? "default" : "outline"} onClick={() => setAgg("year")}>
                  Year
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls — mobile */}
        <div className="md:hidden flex items-center justify-between gap-3 mb-4">
          <Select value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>{yearOptions}</SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button size="sm" variant={agg === "month" ? "default" : "outline"} onClick={() => setAgg("month")}>
              Month
            </Button>
            <Button size="sm" variant={agg === "year" ? "default" : "outline"} onClick={() => setAgg("year")}>
              Year
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Total Jobs ({agg === "year" ? `Year ${activeYear}` : `Month ${currentMonthLabel}`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={BarChart2} label="Total Jobs" value={kpiJobs} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Total Time ({agg === "year" ? `Year ${activeYear}` : `Month ${currentMonthLabel}`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={Clock} label="Total Time" value={formatMinutes(kpiHours * 60)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meetings by Dept ({agg === "year" ? "Year" : "Month"})</CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={Users} label="Meetings by Dept" value={kpiDept} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Period</CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={CalendarDays} label={agg === "year" ? "Year" : "Month"} value={agg === "year" ? activeYear : currentMonthLabel} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 mb-4">
            <TabsTrigger value="jobs">Total Jobs</TabsTrigger>
            <TabsTrigger value="hours">Total Hours</TabsTrigger>
            <TabsTrigger value="dept">Dept Meetings</TabsTrigger>
            <TabsTrigger value="types">Meeting Types</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <JobsTab ctx={ctx} />
          </TabsContent>
          <TabsContent value="hours">
            <HoursTab ctx={ctx} />
          </TabsContent>
          <TabsContent value="dept">
            <DeptTab ctx={ctx} />
          </TabsContent>
          <TabsContent value="types">
            <TypesTab ctx={ctx} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
