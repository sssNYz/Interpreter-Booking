"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Clock, BarChart2, RefreshCw } from "lucide-react";

import { JobsTab } from "@/components/AdminDashboards/jobs-total";
import { HoursTab } from "@/components/AdminDashboards/timejobs-total";
import { DeptTab } from "@/components/AdminDashboards/deptjobs-total";
import { TypesTab } from "@/components/AdminDashboards/mtgtypejobs-total";
import { AssignmentLogsTab } from "@/components/AdminDashboards/assignment-logs";

import { formatMinutes, getCurrentFiscalMonthLabel , years  } from "@/utils/admin-dashboard";
import type { JobsApiResponse, HoursApiResponse, DepartmentsApiResponse, TypesApiResponse } from "@/types/admin-dashboard";

/* ---------------- Theme wrapper ---------------- */
const PAGE_WRAPPER = "min-h-screen bg-[#f7f7f7] font-sans text-gray-900";

/* ---------------- UI ---------------- */

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

/* ---------------- Main component ---------------- */
export default function Page() {
  const [activeYear, setActiveYear] = useState<number>(years[0]);
  const [agg, setAgg] = useState<"month" | "year">("month");
  const [activeTab, setActiveTab] = useState<string>("jobs");
  const [jobsData, setJobsData] = useState<JobsApiResponse | null>(null);
  const [hoursData, setHoursData] = useState<HoursApiResponse | null>(null);
  const [deptData, setDeptData] = useState<DepartmentsApiResponse | null>(null);
  const [typesData, setTypesData] = useState<TypesApiResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentMonthLabel = getCurrentFiscalMonthLabel();

  // Fetch data function that can be called manually or on mount
  const fetchDashboardData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true);
    }
    try {
      const responses = await Promise.all([
        fetch(`/api/admin-dashboard/jobs-total/${activeYear}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin-dashboard/timejobs-total/${activeYear}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin-dashboard/dept-total/${activeYear}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin-dashboard/typesjob-total/${activeYear}`, {
          cache: "no-store",
        }),
      ]);

      const [jobsRes, hoursRes, deptRes, typesRes] = responses;

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobsData(jobsData);
      }

      if (hoursRes.ok) {
        const hoursData = await hoursRes.json();
        setHoursData(hoursData);
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDeptData(deptData);
      }

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setTypesData(typesData);
      }
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    } finally {
      if (showLoading) {
        setIsRefreshing(false);
      }
    }
  }, [activeYear]);

  // Fetch data from existing admin-dashboard APIs with optimized caching
  useEffect(() => {
    let alive = true;

    fetchDashboardData(false).then(() => {
      if (!alive) return;
    });

    return () => {
      alive = false;
    };
  }, [activeYear, fetchDashboardData]);

  // KPI - Use API data from existing endpoints
  const kpiJobs =
    agg === "year"
      ? jobsData?.jobsFooter?.grand || 0
      : (() => {
          if (!jobsData?.months || !jobsData?.totalJobsStack) return 0;
          const currentMonthIndex = jobsData.months.indexOf(currentMonthLabel);
          return currentMonthIndex >= 0 ? jobsData.totalJobsStack[currentMonthIndex]?.total || 0 : 0;
        })();

  const kpiHours =
    agg === "year"
      ? hoursData?.hoursFooter?.grand || 0
      : (() => {
          if (!hoursData?.months || !hoursData?.totalHoursLineMinutes) return 0;
          const currentMonthIndex = hoursData.months.indexOf(currentMonthLabel);
          return currentMonthIndex >= 0 ? hoursData.totalHoursLineMinutes[currentMonthIndex]?.total || 0 : 0;
        })();

  const kpiDept =
    agg === "year"
      ? deptData?.deptMGIFooter?.grand || 0
      : (() => {
          if (!deptData?.months || !deptData?.yearData) return 0;
          const currentMonthIndex = deptData.months.indexOf(currentMonthLabel);
          if (currentMonthIndex < 0) return 0;
          const currentMonthData = deptData.yearData[currentMonthIndex];
          return currentMonthData
            ? Object.values(currentMonthData.deptMeetings).reduce((sum: number, val: number) => sum + (val || 0), 0)
            : 0;
        })();

  // Get current month data for types KPI
  const kpiTypes =
    agg === "year"
      ? typesData?.typesMGIFooter?.grand || 0
      : (() => {
          if (!typesData?.months || !typesData?.typesMGIFooter) return 0;
          return typesData.typesMGIFooter.grand || 0;
        })();

  // year options
  const yearOptions = years.map((y) => (
    <SelectItem key={y} value={String(y)}>
      {y}
    </SelectItem>
  ));

  return (
    <div className={PAGE_WRAPPER}>
      {/* Top Header */}
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
            {/* Controls (Year + Month/Year) */}
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
              {/*Logs button*/}
              <Button size="sm" variant="secondary" onClick={() => setActiveTab("logs")}>
                View Logs
              </Button>
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
              <Stat icon={Clock} label="Total Time" value={formatMinutes(kpiHours)} />
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
              <CardTitle className="text-base">Meeting Types ({agg === "year" ? "Year" : "Month"})</CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={BarChart2} label="Meeting Types" value={kpiTypes} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Removed 'Logs' trigger — use only the head button */}
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid grid-cols-2 lg:grid-cols-4">
              <TabsTrigger value="jobs">Total Jobs</TabsTrigger>
              <TabsTrigger value="hours">Total Hours</TabsTrigger>
              <TabsTrigger value="dept">Dept Meetings</TabsTrigger>
              <TabsTrigger value="types">Meeting Types</TabsTrigger>
            </TabsList>
            {/* Refresh Data Button */}
            <Button 
              onClick={() => fetchDashboardData(true)} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>

          <TabsContent value="jobs">
            <JobsTab year={activeYear} />
          </TabsContent>
          <TabsContent value="hours">
            <HoursTab year={activeYear} />
          </TabsContent>
          <TabsContent value="dept">
            <DeptTab year={activeYear} />
          </TabsContent>
          <TabsContent value="types">
            <TypesTab year={activeYear} />
          </TabsContent>
          <TabsContent value="logs">
            <AssignmentLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
