"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Clock, BarChart2, RefreshCw, ChevronDown } from "lucide-react";

import { JobsTab } from "@/components/AdminDashboards/TotalMonth/jobs-total";
import { HoursTab } from "@/components/AdminDashboards/TotalMonth/timejobs-total";
import { DeptTab } from "@/components/AdminDashboards/TotalMonth/deptjobs-total";
import { TypesTab } from "@/components/AdminDashboards/TotalMonth/mtgtypejobs-total";
import { AssignmentLogsTab } from "@/components/AdminDashboards/TotalMonth/assignment-logs";

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
  const [agg, setAgg] = useState<"month" | "totalAll">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentFiscalMonthLabel());
  const [activeTab, setActiveTab] = useState<string>("jobs");
  const [jobsData, setJobsData] = useState<JobsApiResponse | null>(null);
  const [hoursData, setHoursData] = useState<HoursApiResponse | null>(null);
  const [deptData, setDeptData] = useState<DepartmentsApiResponse | null>(null);
  const [typesData, setTypesData] = useState<TypesApiResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthWrapperDesktopRef = useRef<HTMLDivElement | null>(null);
  const monthWrapperMobileRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside the month button group (desktop or mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMonthDropdownOpen) return;
      const targetNode = event.target instanceof Node ? event.target : null;
      const isInsideDesktop = monthWrapperDesktopRef.current?.contains(targetNode as Node);
      const isInsideMobile = monthWrapperMobileRef.current?.contains(targetNode as Node);
      if (!isInsideDesktop && !isInsideMobile) setIsMonthDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthDropdownOpen]);

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
    agg === "totalAll"
      ? jobsData?.jobsFooter?.grand || 0
      : (() => {
          if (!jobsData?.months || !jobsData?.totalJobsStack) return 0;
          const monthIndex = jobsData.months.indexOf(selectedMonth);
          return monthIndex >= 0 ? jobsData.totalJobsStack[monthIndex]?.total || 0 : 0;
        })();

  const kpiHours =
    agg === "totalAll"
      ? hoursData?.hoursFooter?.grand || 0
      : (() => {
          if (!hoursData?.months || !hoursData?.totalHoursLineMinutes) return 0;
          const monthIndex = hoursData.months.indexOf(selectedMonth);
          return monthIndex >= 0 ? hoursData.totalHoursLineMinutes[monthIndex]?.total || 0 : 0;
        })();

  const kpiDept =
    agg === "totalAll"
      ? deptData?.deptMGIFooter?.grand || 0
      : (() => {
          if (!deptData?.months || !deptData?.yearData) return 0;
          const monthIndex = deptData.months.indexOf(selectedMonth);
          if (monthIndex < 0) return 0;
          const monthData = deptData.yearData[monthIndex];
          return monthData
            ? Object.values(monthData.deptMeetings).reduce((sum: number, val: number) => sum + (val || 0), 0)
            : 0;
        })();

  // Get selected month data for types KPI
  const kpiTypes =
    agg === "totalAll"
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

  // Month options — prefer whichever dataset has months
  const monthOptions = useMemo(() => {
    return (
      jobsData?.months ||
      hoursData?.months ||
      deptData?.months ||
      typesData?.months ||
      []
    );
  }, [jobsData?.months, hoursData?.months, deptData?.months, typesData?.months]);

  // Ensure selectedMonth is always one of available options once data arrives
  useEffect(() => {
    if (!monthOptions || monthOptions.length === 0) return;
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) {
      // Try to pick current fiscal month if present, otherwise use the last month (most recent)
      const current = getCurrentFiscalMonthLabel();
      const fallback = monthOptions.includes(current)
        ? current
        : monthOptions[monthOptions.length - 1];
      setSelectedMonth(fallback);
    }
  }, [monthOptions, selectedMonth]);

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
            {/* Controls (Year + Month/Total All) */}
            <div className="hidden md:flex items-center gap-3">
              <Select value={String(activeYear)} onValueChange={(v) => setActiveYear(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>{yearOptions}</SelectContent>
              </Select>
              
              {/* Custom Button Group with Smooth Transitions */}
              <div className="relative flex bg-gray-100 rounded-md p-0.5 h-8 w-56">
                {/* Highlight Bar */}
                <div 
                  className={`absolute inset-y-0 left-0 w-1/2 bg-gray-900 rounded transition-transform duration-300 ease-in-out z-0 pointer-events-none ${
                    agg === "month" ? "translate-x-0" : "translate-x-full"
                  }`}
                />
                
                {/* Month Dropdown Button */}
                <div ref={monthWrapperDesktopRef} className="relative basis-1/2 grow-0 shrink-0">
                  <button 
                    className={`relative z-10 w-full h-full px-3 text-sm font-medium rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis leading-none focus:outline-none focus-visible:outline-none ${
                      agg === "month" 
                        ? "text-white bg-transparent" 
                        : "text-gray-700 bg-transparent"
                    }`}
                    onClick={() => {
                      if (agg !== "month") {
                        setAgg("month");
                        setIsMonthDropdownOpen(false);
                      } else {
                        setIsMonthDropdownOpen((prev) => !prev);
                      }
                    }}
                  >
                    {agg === "month" ? selectedMonth : "Month"}
                    <ChevronDown className={`ml-1 h-3 w-3 transition-transform duration-200 ${
                      isMonthDropdownOpen ? "rotate-180" : ""
                    }`} />
                  </button>
                  
                  {/* Month Dropdown */}
                  {isMonthDropdownOpen && monthOptions && monthOptions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                      {monthOptions.map((month) => (
                        <button
                          key={month}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 first:rounded-t-md last:rounded-b-md transition-colors ${
                            selectedMonth === month ? "bg-gray-100 font-medium" : ""
                          }`}
                          onClick={() => {
                            setSelectedMonth(month);
                            setAgg("month");
                            setIsMonthDropdownOpen(false);
                          }}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Total All Button */}
                <div className="basis-1/2 grow-0 shrink-0">
                  <button 
                    className={`relative z-10 w-full h-full px-3 text-sm font-medium rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis leading-none focus:outline-none focus-visible:outline-none ${
                      agg === "totalAll" 
                        ? "text-white bg-transparent" 
                        : "text-gray-700 bg-transparent"
                    }`}
                    onClick={() => {
                      setAgg("totalAll");
                      setIsMonthDropdownOpen(false);
                    }}
                  >
                    Total All
                  </button>
                </div>
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
          
          {/* Mobile Button Group */}
          <div className="relative flex bg-gray-100 rounded-md p-0.5 gap-0.5 h-6 w-48">
            {/* Highlight Bar */}
            <div 
              className={`absolute top-0.5 bottom-0.5 bg-gray-900 rounded transition-all duration-300 ease-in-out ${
                agg === "month" ? "left-0.5 right-1/2" : "left-1/2 right-0.5"
              }`}
            />
            
            {/* Month Dropdown Button */}
            <div ref={monthWrapperMobileRef} className="relative flex-1">
              <button 
                className={`w-full h-full px-1.5 text-xs rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap leading-none focus:outline-none focus-visible:outline-none ${
                  agg === "month" 
                    ? "text-white bg-transparent" 
                    : "text-gray-700 bg-transparent"
                }`}
                onClick={() => {
                  if (agg !== "month") {
                    setAgg("month");
                    setIsMonthDropdownOpen(false);
                  } else {
                    setIsMonthDropdownOpen((prev) => !prev);
                  }
                }}
              >
                {agg === "month" ? selectedMonth : "Month"}
                <ChevronDown className={`ml-1 h-2 w-2 transition-transform duration-200 ${
                  isMonthDropdownOpen ? "rotate-180" : ""
                }`} />
              </button>
              
              {/* Month Dropdown */}
              {isMonthDropdownOpen && monthOptions && monthOptions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                  {monthOptions.map((month) => (
                    <button
                      key={month}
                      className={`w-full text-left px-1.5 py-1 text-xs hover:bg-gray-100 first:rounded-t-md last:rounded-b-md transition-colors ${
                        selectedMonth === month ? "bg-gray-100 font-medium" : ""
                      }`}
                      onClick={() => {
                        setSelectedMonth(month);
                        setAgg("month");
                        setIsMonthDropdownOpen(false);
                      }}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Total All Button */}
            <div className="flex-1">
              <button 
                className={`w-full h-full px-1.5 text-xs rounded transition-colors duration-200 flex items-center justify-center whitespace-nowrap leading-none focus:outline-none focus-visible:outline-none ${
                  agg === "totalAll" 
                    ? "text-white bg-transparent" 
                    : "text-gray-700 bg-transparent"
                }`}
                onClick={() => {
                  setAgg("totalAll");
                  setIsMonthDropdownOpen(false);
                }}
              >
                Total All
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Total Jobs ({agg === "totalAll" ? `Year ${activeYear}` : `Month ${selectedMonth}`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={BarChart2} label="Total Jobs" value={kpiJobs} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Total Time ({agg === "totalAll" ? `Year ${activeYear}` : `Month ${selectedMonth}`})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={Clock} label="Total Time" value={formatMinutes(kpiHours)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meetings by Dept ({agg === "totalAll" ? "Year" : "Month"})</CardTitle>
            </CardHeader>
            <CardContent>
              <Stat icon={Users} label="Meetings by Dept" value={kpiDept} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meeting Types ({agg === "totalAll" ? "Year" : "Month"})</CardTitle>
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
            <JobsTab year={activeYear} data={jobsData} />
          </TabsContent>
          <TabsContent value="hours">
            <HoursTab year={activeYear} data={hoursData} />
          </TabsContent>
          <TabsContent value="dept">
            <DeptTab year={activeYear} data={deptData} />
          </TabsContent>
          <TabsContent value="types">
            <TypesTab year={activeYear} data={typesData} />
          </TabsContent>
          <TabsContent value="logs">
            <AssignmentLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
