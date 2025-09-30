"use client";

import React, { useState, useEffect } from "react";
import { DayPilot, DayPilotCalendar } from "@daypilot/daypilot-lite-react";
import { toast } from "sonner";
import { client as featureFlags } from "@/lib/feature-flags";

const BookingRoom = () => {
  const [calendar, setCalendar] = useState<DayPilot.Calendar>();

  // Calendar configuration for Resources view
  const config = {
    viewType: "Resources" as const,
    scale: "Hour" as const,
    startDate: DayPilot.Date.today().firstDayOfWeek("en-us"),
    days: 7,
    headerHeight: 40,
    height: 300,
    cellHeight: 40,
    columns: [
      { name: "Meeting Room A", id: "A" },
      { name: "Meeting Room B", id: "B" },
      { name: "Meeting Room C", id: "C" },
      { name: "Meeting Room D", id: "D" },
      { name: "Meeting Room E", id: "E" },
      { name: "Meeting Room F", id: "F" },
    ],
    onTimeRangeSelected: async (args: any) => {
      const modal = await DayPilot.Modal.prompt("New event name:", "Event");
      if (modal.canceled) return;
      calendar?.events.add({
        start: args.start,
        end: args.end,
        id: DayPilot.guid(),
        resource: args.resource,
        text: modal.result,
      });
      calendar?.clearSelection();
      toast.success("✅ Booking created successfully!");
    },
    onBeforeTimeHeaderRender: (args: any) => {
      args.header.areas = [
        {
          left: 0,
          right: 0,
          bottom: 0,
          text: args.header.date.toString("MMM d"),
          horizontalAlignment: "center",
          fontColor: "#ccc",
        },
      ];
    },
  };

  // Sample events data
  const events = [
    {
      start: DayPilot.Date.today().firstDayOfWeek().addHours(9),
      end: DayPilot.Date.today().firstDayOfWeek().addHours(11),
      id: DayPilot.guid(),
      resource: "B",
      text: "Marketing Team",
      barColor: "#674ea7",
    },
    {
      start: DayPilot.Date.today().firstDayOfWeek().addHours(14),
      end: DayPilot.Date.today().firstDayOfWeek().addHours(16),
      id: DayPilot.guid(),
      resource: "B",
      text: "Development Team",
      barColor: "#a64d79",
    },
    {
      start: DayPilot.Date.today().firstDayOfWeek().addHours(10),
      end: DayPilot.Date.today().firstDayOfWeek().addHours(12),
      id: DayPilot.guid(),
      resource: "A",
      text: "Sales Meeting",
      barColor: "#3d85c6",
    },
    {
      start: DayPilot.Date.today().firstDayOfWeek().addHours(15),
      end: DayPilot.Date.today().firstDayOfWeek().addHours(17),
      id: DayPilot.guid(),
      resource: "C",
      text: "Training Session",
      barColor: "#e69138",
    },
  ];

  if (!featureFlags.enableRoomBooking) {
    return (
      <div className="flex flex-col gap-4 px-4 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold">Room Booking</h1>
        </div>
        <div className="rounded-xl border bg-white p-6 text-gray-700">
          This feature is coming soon.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 mx-auto w-full max-w-full">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold">Room Booking Calendar</h1>
      </div>

      

      <div className="w-full overflow-x-auto">
        <DayPilotCalendar
          {...config}
          events={events}
          ref={(component: any) => {
            setCalendar(component && component.control);
          }}
        />
      </div>
    </div>
  );
};

export default BookingRoom;
