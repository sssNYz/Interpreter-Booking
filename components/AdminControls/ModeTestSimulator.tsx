"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { extractHHMM } from "@/utils/time";
import type { AssignmentPolicy } from "@/types/assignment";

// Types for API responses to avoid usage of 'any'
type ApiBooking = {
  id?: string | number;
  bookingId?: string | number;
  meetingType?: string;
  type?: string;
  date?: string;
  dateTime?: string;
  meetingDate?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  meetingTime?: string;
};

type ApiBookingsResponse = ApiBooking[] | { data: ApiBooking[] } | { bookings: ApiBooking[] };

type ApiUser = {
  id?: string | number;
  employeeId?: string | number;
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  name?: string;
};

type EmployeesResponse = {
  users: ApiUser[];
  pagination?: { totalPages?: number };
};

interface SimulatedDay {
  day: number;
  date: string;
  generalThresholdBookings: string[];
  urgentThresholdBookings: string[];
  assignments: AssignmentResult[];
  status: string;
}

interface AssignmentResult {
  bookingId: string;
  meetingType: string;
  time: string;
  interpreter: string;
  reason: string;
  hours: { [key: string]: number };
}

interface ModeComparison {
  mode: string;
  days: SimulatedDay[];
  finalHours: { [key: string]: number };
  totalGap: number;
}

export default function ModeTestSimulator() {
  const [loading, setLoading] = useState(false);
  const [simulationResults, setSimulationResults] = useState<ModeComparison[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("BALANCE");
  const [simulating, setSimulating] = useState(false);

  // Real data from database
  const [realBookings, setRealBookings] = useState<Array<{id: string, type: string, date: string, time: string, daysAway: number}>>([]);
  const [realInterpreters, setRealInterpreters] = useState<Array<{id: string, name: string, currentHours: number}>>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load real data from database
  const loadRealData = async () => {
    setLoadingData(true);
    try {
      // Load real bookings
      const bookingsResponse = await fetch("/api/booking-data/get-booking");
      const bookingsData: ApiBookingsResponse = await bookingsResponse.json();
      
      // Load ALL interpreters across pages (employees API is paginated and returns { users, pagination })
      const fetchAllInterpreters = async (): Promise<ApiUser[]> => {
        const pageSize = 100;
        let page = 1;
        let totalPages = 1;
        const all: ApiUser[] = [];
        do {
          const res = await fetch(`/api/employees/get-employees?page=${page}&pageSize=${pageSize}&role=INTERPRETER`);
          const json: EmployeesResponse = await res.json();
          const users = Array.isArray(json?.users) ? json.users : [];
          all.push(...users);
          const total = json?.pagination?.totalPages;
          totalPages = typeof total === 'number' ? total : 1;
          page += 1;
        } while (page <= totalPages);
        return all;
      };

      console.log("Bookings response:", bookingsData);
      
      // Safely extract arrays from API responses
      const bookingsArray: ApiBooking[] = Array.isArray(bookingsData)
        ? bookingsData
        : ("data" in bookingsData && Array.isArray(bookingsData.data))
          ? bookingsData.data
          : ("bookings" in bookingsData && Array.isArray(bookingsData.bookings))
            ? bookingsData.bookings
            : [];

      const interpretersAll = await fetchAllInterpreters();
      
      if (bookingsArray.length > 0 || interpretersAll.length > 0) {
        // Transform real data to match simulator format
        const transformedBookings = bookingsArray.map((booking: ApiBooking, index: number) => {
          const id = String(booking.id ?? booking.bookingId ?? `booking-${index}`);
          const type = String(booking.meetingType ?? booking.type ?? "General");
          const isoStart = (booking as any).timeStart as string | undefined;
          const isoEnd = (booking as any).timeEnd as string | undefined;
          const date = String(
            booking.date ?? booking.dateTime ?? booking.meetingDate ?? (isoStart ? new Date(isoStart).toISOString().split("T")[0] : "Unknown")
          );
          const start = booking.startTime ?? (isoStart ? extractHHMM(isoStart) : undefined);
          const end = booking.endTime ?? (isoEnd ? extractHHMM(isoEnd) : undefined);
          const combined = start && end ? `${start}-${end}` : undefined;
          const time = String(booking.time ?? combined ?? booking.meetingTime ?? "00:00-00:00");
          return {
            id,
            type,
            date,
            time,
            daysAway: Math.floor(Math.random() * 15) + 1,
          };
        });
        
        const transformedInterpreters = interpretersAll.map((user: ApiUser, index: number) => {
          const id = String(user.id ?? user.employeeId ?? `interpreter-${index}`);
          const firstName = String(user.firstNameEn ?? user.firstNameTh ?? user.name ?? "");
          const lastName = String(user.lastNameEn ?? user.lastNameTh ?? "");
          const displayName = (firstName + " " + lastName).trim() || `Interpreter ${index + 1}`;
          return {
            id,
            name: displayName,
            currentHours: 0,
          };
        });
        
        setRealBookings(transformedBookings);
        setRealInterpreters(transformedInterpreters);
        toast.success(`Loaded ${transformedBookings.length} bookings and ${transformedInterpreters.length} interpreters!`);
      } else {
        toast.error("No data found in API responses");
      }
    } catch (error) {
      console.error("Error loading real data:", error);
      toast.error("Failed to load real data");
    } finally {
      setLoadingData(false);
    }
  };

  // Use real data or fallback to mock data
  const bookings = realBookings.length > 0 ? realBookings : [
    { id: "1", type: "DR", date: "10th", time: "10:00-12:00", daysAway: 9 },
    { id: "2", type: "General", date: "11th", time: "9:00-10:00", daysAway: 10 },
    { id: "3", type: "DR", date: "12th", time: "14:00-15:00", daysAway: 11 },
    { id: "4", type: "DR", date: "10th", time: "12:00-14:00", daysAway: 9 }
  ];

  const interpreters = realInterpreters.length > 0 ? realInterpreters : [
    { id: "A", name: "Interpreter A", currentHours: 0 },
    { id: "B", name: "Interpreter B", currentHours: 0 }
  ];

  const simulateDayByDay = async () => {
    setSimulating(true);
    setLoading(true);

    try {
      // Simulate for each mode
      const modes = ["BALANCE", "URGENT", "NORMAL"];
      const results: ModeComparison[] = [];

      for (const mode of modes) {
        const modeResult = await simulateMode(mode, bookings, interpreters);
        results.push(modeResult);
      }

      setSimulationResults(results);
      toast.success("Simulation completed! Check the results below.");
    } catch (error) {
      console.error("Simulation error:", error);
      toast.error("Simulation failed. Please try again.");
    } finally {
      setLoading(false);
      setSimulating(false);
    }
  };

  const simulateMode = async (mode: string, bookings: Array<{id: string, type: string, date: string, time: string, daysAway: number}>, interpreters: Array<{id: string, name: string, currentHours: number}>): Promise<ModeComparison> => {
    const days: SimulatedDay[] = [];
    const currentHours = { A: 0, B: 0 };
    const assignments: AssignmentResult[] = [];

    // Simulate 15 days
    for (let day = 1; day <= 15; day++) {
      const currentDate = new Date(2024, 0, day); // January 1st, 2nd, 3rd...
      const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Check which bookings reach thresholds
      const generalThresholdBookings = bookings
        .filter(b => b.daysAway === (15 - day + 7)) // General threshold at 7 days
        .map(b => `${b.type} ${b.date} (${b.time})`);

      const urgentThresholdBookings = bookings
        .filter(b => b.daysAway === (15 - day + 4)) // Urgent threshold at 4 days
        .map(b => `${b.type} ${b.date} (${b.time})`);

      // Simulate assignments based on mode
      const dayAssignments: AssignmentResult[] = [];
      let status = "No assignments";

      if (urgentThresholdBookings.length > 0) {
        // Simulate assignment logic based on mode
        if (mode === "BALANCE") {
          // Balance mode: assign to interpreter with lower hours
          const interpreter = currentHours.A <= currentHours.B ? "A" : "B";
          const booking = bookings.find(b => b.daysAway === (15 - day + 4));
          
          if (booking) {
            const hours = booking.type === "DR" ? 2 : 1;
            currentHours[interpreter as keyof typeof currentHours] += hours;
            
            dayAssignments.push({
              bookingId: booking.id,
              meetingType: booking.type,
              time: booking.time,
              interpreter: `Interpreter ${interpreter}`,
              reason: `Balance mode: assigned to interpreter with lower hours`,
              hours: { ...currentHours }
            });
            
            assignments.push(...dayAssignments);
            status = `Assigned ${dayAssignments.length} urgent booking(s)`;
          }
        } else if (mode === "URGENT") {
          // Urgent mode: assign immediately to first available
          const interpreter = "A"; // Simulate first available
          const booking = bookings.find(b => b.daysAway === (15 - day + 4));
          
          if (booking) {
            const hours = booking.type === "DR" ? 2 : 1;
            currentHours[interpreter as keyof typeof currentHours] += hours;
            
            dayAssignments.push({
              bookingId: booking.id,
              meetingType: booking.type,
              time: booking.time,
              interpreter: `Interpreter ${interpreter}`,
              reason: `Urgent mode: immediate assignment`,
              hours: { ...currentHours }
            });
            
            assignments.push(...dayAssignments);
            status = `Assigned ${dayAssignments.length} urgent booking(s)`;
          }
        } else {
          // Normal mode: balanced assignment
          const interpreter = currentHours.A <= currentHours.B ? "A" : "B";
          const booking = bookings.find(b => b.daysAway === (15 - day + 4));
          
          if (booking) {
            const hours = booking.type === "DR" ? 2 : 1;
            currentHours[interpreter as keyof typeof currentHours] += hours;
            
            dayAssignments.push({
              bookingId: booking.id,
              meetingType: booking.type,
              time: booking.time,
              interpreter: `Interpreter ${interpreter}`,
              reason: `Normal mode: balanced assignment`,
              hours: { ...currentHours }
            });
            
            assignments.push(...dayAssignments);
            status = `Assigned ${dayAssignments.length} urgent booking(s)`;
          }
        }
      }

      days.push({
        day,
        date: dateStr,
        generalThresholdBookings,
        urgentThresholdBookings,
        assignments: dayAssignments,
        status
      });
    }

    const totalGap = Math.abs(currentHours.A - currentHours.B);

    return {
      mode,
      days,
      finalHours: currentHours,
      totalGap
    };
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mode Test Simulator</h1>
        <div className="flex items-center space-x-4">
          <Select value={selectedMode} onValueChange={setSelectedMode}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select mode to focus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BALANCE">Balance Mode</SelectItem>
              <SelectItem value="URGENT">Urgent Mode</SelectItem>
              <SelectItem value="NORMAL">Normal Mode</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={loadRealData} 
            disabled={loadingData}
            variant="outline"
            className="bg-green-50 hover:bg-green-100"
          >
            {loadingData ? "Loading..." : "📊 Load Real Data"}
          </Button>
          <Button 
            onClick={simulateDayByDay} 
            disabled={simulating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {simulating ? "Running Simulation..." : "🚀 Run Day-by-Day Simulation"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Info</CardTitle>
          <CardDescription>
            This simulator shows what would happen day-by-day with different assignment modes.
            It uses your real booking data but never changes the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Data Source:</h4>
              <Badge variant={realBookings.length > 0 ? "default" : "secondary"}>
                {realBookings.length > 0 ? "Real Database" : "Mock Data"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Test Bookings:</h4>
                <ul className="space-y-1 text-sm">
                  {bookings.map(booking => (
                    <li key={booking.id} className="flex items-center space-x-2">
                      <Badge variant={booking.type === "DR" ? "destructive" : "secondary"}>
                        {booking.type}
                      </Badge>
                      <span>{booking.date} {booking.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Interpreters:</h4>
                <ul className="space-y-1 text-sm">
                  {interpreters.map(interpreter => (
                    <li key={interpreter.id}>
                      {interpreter.name}: {interpreter.currentHours} hours
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {realBookings.length === 0 && (
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  Click 📊 Load Real Data to connect to your database
                </p>
              </div>
            )}
            
            {realBookings.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <h5 className="font-medium text-green-800 mb-2">Debug Info:</h5>
                <div className="text-xs text-green-700 space-y-1">
                  <div>Bookings loaded: {realBookings.length}</div>
                  <div>Interpreters loaded: {realInterpreters.length}</div>
                  <div>First booking: {JSON.stringify(realBookings[0])}</div>
                  <div>First interpreter: {JSON.stringify(realInterpreters[0])}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-lg">Running simulation...</div>
        </div>
      )}

      {simulationResults.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Simulation Results</h2>
          
          {/* Mode Comparison Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Mode Comparison Summary</CardTitle>
              <CardDescription>Final results for each mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {simulationResults.map((result) => (
                  <div key={result.mode} className="p-4 border rounded-lg">
                    <h3 className="font-bold text-lg mb-2">{result.mode} Mode</h3>
                    <div className="space-y-2 text-sm">
                      <div>Interpreter A: {result.finalHours.A} hours</div>
                      <div>Interpreter B: {result.finalHours.B} hours</div>
                      <div className="font-medium">Gap: {result.totalGap} hours</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Day-by-Day Results */}
          {simulationResults.map((result) => (
            <Card key={result.mode} className={result.mode === selectedMode ? "ring-2 ring-blue-500" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>{result.mode} Mode</span>
                  {result.mode === selectedMode && <Badge variant="default">Focused</Badge>}
                </CardTitle>
                <CardDescription>
                  Day-by-day simulation results for {result.mode} mode
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.days.map((day) => (
                    <div key={day.day} className="border-l-4 border-gray-200 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Day {day.day} ({day.date})</h4>
                        <Badge variant="outline">{day.status}</Badge>
                      </div>
                      
                      {day.generalThresholdBookings.length > 0 && (
                        <div className="mb-2">
                          <span className="text-sm text-yellow-600">⚠️ General Threshold: </span>
                          {day.generalThresholdBookings.join(", ")}
                        </div>
                      )}
                      
                      {day.urgentThresholdBookings.length > 0 && (
                        <div className="mb-2">
                          <span className="text-sm text-red-600">🚨 Urgent Threshold: </span>
                          {day.urgentThresholdBookings.join(", ")}
                        </div>
                      )}
                      
                      {day.assignments.length > 0 && (
                        <div className="space-y-2">
                          {day.assignments.map((assignment, index) => (
                            <div key={index} className="bg-green-50 p-2 rounded text-sm">
                              <div className="font-medium">✅ {assignment.meetingType} {assignment.time}</div>
                              <div>Assigned to: {assignment.interpreter}</div>
                              <div>Reason: {assignment.reason}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                Hours: A={assignment.hours.A}, B={assignment.hours.B}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
