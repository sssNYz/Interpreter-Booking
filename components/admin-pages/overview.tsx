"use client";
import React, { useState } from 'react';
import { Calendar, Clock, Users, TrendingUp, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { weeklyData, recentBookings, Booking } from '@/data/overview'; // Mock data import

// Subcomponents using shadcn/ui
const StatCard = ({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: React.ReactNode;
  trend?: string;
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-full">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center mt-4 text-sm">
          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          <span className="text-green-600 font-medium">{trend}</span>
          <span className="text-muted-foreground ml-1">vs last week</span>
        </div>
      )}
    </CardContent>
  </Card>
);

type WeeklyChartData = { day: string; value: number };

const WeeklyChart = ({ data }: { data: WeeklyChartData[] }) => {
  const totalBookings = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weekly Booking Overview</CardTitle>
            <CardDescription>Track your booking patterns throughout the week</CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{totalBookings} bookings</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
              />
              <Bar
                dataKey="value"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusBadge = ({ status }: { status: 'confirmed' | 'pending' | 'completed' | 'cancelled' }) => {
  const statusConfig: Record<
    'confirmed' | 'pending' | 'completed' | 'cancelled',
    {
      variant: 'outline' | 'destructive' | 'default' | 'secondary';
      label: string;
      className: string;
    }
  > = {
    confirmed: {
      variant: 'default',
      label: 'Confirmed',
      className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
    },
    pending: {
      variant: 'secondary',
      label: 'Pending',
      className: 'bg-amber-100 text-amber-800 hover:bg-amber-100'
    },
    completed: {
      variant: 'outline',
      label: 'Completed',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-100'
    },
    cancelled: {
      variant: 'destructive',
      label: 'Cancelled',
      className: 'bg-red-100 text-red-800 hover:bg-red-100'
    }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
};

const RecentBookingTable = ({ bookings }: { bookings: Booking[] }) => {
  const [timeFilter, setTimeFilter] = useState('today');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Get unique years from bookings data
  const getAvailableYears = () => {
    const years = bookings.map(booking => new Date(booking.dateTime).getFullYear());
    return [...new Set(years)].sort((a, b) => b - a); // Sort descending (newest first)
  };

  const availableYears = getAvailableYears();

  const filterBookings = (bookings: Booking[], filter: string, yearValue: number) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return bookings.filter(booking => {
      const bookingDate = new Date(booking.dateTime);

      switch (filter) {
        case 'today':
          const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
          return bookingDay.getTime() === today.getTime();

        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return bookingDate >= weekStart && bookingDate <= weekEnd;

        case 'month':
          return bookingDate.getMonth() === now.getMonth() &&
            bookingDate.getFullYear() === now.getFullYear();

        case 'year':
          return bookingDate.getFullYear() === yearValue;

        case 'all':
          return true;

        default:
          return true;
      }
    });
  };

  const filteredBookings = filterBookings(bookings, timeFilter, selectedYear);

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return `Year ${selectedYear}`;
      case 'all': return 'All Time';
      default: return 'Unknown';
    }
  };

  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    // If switching to year filter and current selected year doesn't have data, 
    // set to the first available year
    if (value === 'year' && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || new Date().getFullYear());
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>
              Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} • {getFilterLabel()}
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />

            {/* Primary Time Filter */}
            <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Year Selector (only show when "Year" is selected) */}
            {timeFilter === 'year' && (
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredBookings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-sm font-medium mb-2">No bookings found</h3>
            <p className="text-sm text-muted-foreground">
              No bookings match the selected time period: {getFilterLabel()}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Interpreter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Topic
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Booked By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {filteredBookings
                  .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()) // Sort by date, newest first
                  .map((booking) => (
                    <tr key={booking.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {booking.dateTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {booking.interpreter}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {booking.room}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs">
                        <div className="truncate" title={booking.topic}>
                          {booking.topic}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {booking.bookedBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Overview Component
const Overview = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Overview</h1>
          <p className="text-muted-foreground mt-2">Monitor your interpreter booking system performance and manage requests</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={Calendar}
            label="Today's Bookings"
            value="12"
            trend="+20%"
          />
          <StatCard
            icon={Clock}
            label="Pending Approvals"
            value="3"
            trend="-12%"
          />
          <StatCard
            icon={Users}
            label="Active Interpreters"
            value="28"
            trend="+5%"
          />
        </div>

        {/* Weekly Chart */}
        <div className="mb-8">
          <WeeklyChart data={weeklyData} />
        </div>

        {/* Recent Bookings Table */}
        <RecentBookingTable bookings={recentBookings} />
      </div>
    </div>
  );
};

export default Overview;