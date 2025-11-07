"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type TimeSlot = {
    hour: number;
    minute: number;
    label: string;
    available: boolean;
};

type Props = {
    selectedDate?: Date;
    selectedStartTime?: string;
    selectedEndTime?: string;
    selectedRoom?: string;
    environmentId?: number;
    bookingId?: number; // For edit mode, exclude current booking from conflict check
    onDateChange?: (date: Date | undefined) => void;
    onStartTimeChange?: (time: string) => void;
    onEndTimeChange?: (time: string) => void;
    disabled?: boolean;
};

export const DateTimePicker: React.FC<Props> = ({
    selectedDate,
    selectedStartTime,
    selectedEndTime,
    selectedRoom,
    environmentId,
    bookingId,
    onDateChange,
    onStartTimeChange,
    onEndTimeChange,
    disabled = false,
}) => {
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pastTimeWarning, setPastTimeWarning] = useState<string | null>(null);

    // Generate time slots from 08:00 to 20:00 with 30-minute intervals
    const generateTimeSlots = (): TimeSlot[] => {
        const slots: TimeSlot[] = [];

        for (let hour = 8; hour <= 20; hour++) {
            for (let minute of [0, 30]) {
                if (hour === 20 && minute === 30) continue; // Stop at 20:00

                const label = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                slots.push({
                    hour,
                    minute,
                    label,
                    available: true  // All times are selectable
                });
            }
        }
        return slots;
    };

    // Helper function to check if a time is in the past for today
    const isTimePast = (timeStr: string): boolean => {
        if (!selectedDate) return false;

        const now = new Date();
        const isToday = selectedDate.getDate() === now.getDate() &&
            selectedDate.getMonth() === now.getMonth() &&
            selectedDate.getFullYear() === now.getFullYear();

        if (!isToday) return false;

        const [hour, minute] = timeStr.split(":").map(Number);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        return hour < currentHour || (hour === currentHour && minute <= currentMinute);
    };

    // Check room availability when date, room, or time changes
    useEffect(() => {
        const checkAvailability = async () => {
            if (!selectedDate || !selectedRoom || !selectedStartTime || !selectedEndTime) {
                setAvailableSlots(generateTimeSlots());
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const dateStr = format(selectedDate, "yyyy-MM-dd");
                const params = new URLSearchParams({
                    date: dateStr,
                    room: selectedRoom,
                    startTime: selectedStartTime,
                    endTime: selectedEndTime,
                });

                if (environmentId) params.append("environmentId", environmentId.toString());
                if (bookingId) params.append("excludeBookingId", bookingId.toString());

                const res = await fetch(`/api/booking-data/check-room-availability?${params}`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    throw new Error(`Failed to check availability (${res.status})`);
                }

                const data = await res.json();

                if (data.success) {
                    const allSlots = generateTimeSlots();
                    const conflictingSlots = new Set<string>();

                    // Mark conflicting time slots
                    if (data.conflicts && Array.isArray(data.conflicts)) {
                        data.conflicts.forEach((conflict: { timeStart: string; timeEnd: string }) => {
                            const start = new Date(conflict.timeStart);
                            const end = new Date(conflict.timeEnd);

                            allSlots.forEach((slot) => {
                                const slotTime = new Date(selectedDate);
                                slotTime.setHours(slot.hour, slot.minute, 0, 0);

                                // Check if slot overlaps with conflict
                                if (slotTime >= start && slotTime < end) {
                                    conflictingSlots.add(slot.label);
                                }
                            });
                        });
                    }

                    const updatedSlots = allSlots.map((slot) => ({
                        ...slot,
                        available: !conflictingSlots.has(slot.label),  // Only mark conflicts as unavailable
                    }));

                    setAvailableSlots(updatedSlots);
                } else {
                    setError(data.message || "Failed to check availability");
                    setAvailableSlots(generateTimeSlots());
                }
            } catch (err) {
                console.error("Error checking availability:", err);
                setError((err as Error).message);
                setAvailableSlots(generateTimeSlots());
            } finally {
                setLoading(false);
            }
        };

        void checkAvailability();
    }, [selectedDate, selectedRoom, selectedStartTime, selectedEndTime, environmentId, bookingId]);

    // Check for past time warnings whenever times change
    useEffect(() => {
        if (!selectedDate || !selectedStartTime) {
            setPastTimeWarning(null);
            return;
        }

        const startIsPast = isTimePast(selectedStartTime);
        const endIsPast = selectedEndTime ? isTimePast(selectedEndTime) : false;

        if (startIsPast && endIsPast) {
            setPastTimeWarning("⚠️ Warning: Both start and end times have already passed for today.");
        } else if (startIsPast) {
            setPastTimeWarning("⚠️ Warning: The selected start time has already passed for today.");
        } else if (endIsPast) {
            setPastTimeWarning("⚠️ Warning: The selected end time has already passed for today.");
        } else {
            setPastTimeWarning(null);
        }
    }, [selectedDate, selectedStartTime, selectedEndTime]);

    const handleStartTimeChange = (time: string) => {
        onStartTimeChange?.(time);

        // Auto-adjust end time if it's before or equal to start time
        if (selectedEndTime && selectedEndTime <= time) {
            const [hour, minute] = time.split(":").map(Number);
            let newHour = hour;
            let newMinute = minute + 30;

            if (newMinute >= 60) {
                newHour += 1;
                newMinute = 0;
            }

            if (newHour <= 20) {
                const newEndTime = `${newHour.toString().padStart(2, "0")}:${newMinute.toString().padStart(2, "0")}`;
                onEndTimeChange?.(newEndTime);
            }
        }
    };

    // Helper function to check if date is weekend (Saturday or Sunday)
    const isWeekend = (date: Date): boolean => {
        const day = date.getDay();
        return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
    };

    // Helper function to check if date should be disabled
    const isDateDisabled = (date: Date): boolean => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Disable if past date OR weekend
        return date < today || isWeekend(date);
    };

    return (
        <div className="space-y-4">
            {/* Date Picker */}
            <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Select Date (Weekdays Only)
                </label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            disabled={disabled}
                        >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Pick a date (DD/MM/YYYY)</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={onDateChange}
                            disabled={isDateDisabled}
                        />
                    </PopoverContent>
                </Popover>
                <div className="text-xs text-muted-foreground">
                    ℹ️ Past dates and weekends (Sat/Sun) are disabled
                </div>
            </div>

            {/* Time Selectors */}
            <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Start Time
                    </label>
                    <Select
                        value={selectedStartTime}
                        onValueChange={handleStartTimeChange}
                        disabled={disabled || !selectedDate}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select start time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {availableSlots.map((slot) => (
                                <SelectItem
                                    key={`start-${slot.label}`}
                                    value={slot.label}
                                    disabled={!slot.available}
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <span>{slot.label}</span>
                                        {!slot.available && (
                                            <span className="text-xs text-destructive">(Unavailable)</span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        End Time
                    </label>
                    <Select
                        value={selectedEndTime}
                        onValueChange={onEndTimeChange}
                        disabled={disabled || !selectedDate || !selectedStartTime}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select end time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {availableSlots
                                .filter((slot) => selectedStartTime ? slot.label > selectedStartTime : true)
                                .map((slot) => (
                                    <SelectItem
                                        key={`end-${slot.label}`}
                                        value={slot.label}
                                        disabled={!slot.available}
                                    >
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <span>{slot.label}</span>
                                            {!slot.available && (
                                                <span className="text-xs text-destructive">(Unavailable)</span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Loading/Error States */}
            {loading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3 animate-spin" />
                    Checking availability...
                </div>
            )}

            {error && (
                <div className="text-xs text-destructive flex items-center gap-2 p-2 rounded bg-destructive/10">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </div>
            )}

            {/* Past Time Warning */}
            {pastTimeWarning && (
                <div className="text-xs text-amber-600 flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200">
                    <AlertCircle className="h-3 w-3" />
                    {pastTimeWarning}
                </div>
            )}

            {/* Availability Info - Only show conflicts */}
            {selectedDate && selectedRoom && !loading && !error && availableSlots.filter((s) => !s.available).length > 0 && (
                <div className="text-xs text-muted-foreground p-2 rounded bg-muted/50">
                    <span>⚠️ Some time slots are unavailable due to existing bookings</span>
                </div>
            )}
        </div>
    );
};
