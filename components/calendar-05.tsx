"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"

import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

type Calendar05Props = {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  highlightedDays?: string[] // YYYY-MM-DD array
  defaultMonth?: Date
  onMonthChange?: (month: Date) => void
}

export default function Calendar05({ value, onChange, highlightedDays = [], defaultMonth, onMonthChange }: Calendar05Props) {
  const highlightedSet = React.useMemo(() => new Set(highlightedDays), [highlightedDays])

  return (
    <Calendar
      mode="range"
      defaultMonth={defaultMonth ?? value?.from}
      onMonthChange={onMonthChange}
      selected={value}
      onSelect={onChange}
      numberOfMonths={2}
      className="rounded-lg border shadow-sm"
      components={{
        DayButton: (props) => {
          const date = props.day.date
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, "0")
          const d = String(date.getDate()).padStart(2, "0")
          const ymd = `${y}-${m}-${d}`
          const has = highlightedSet.has(ymd)
          return (
            <CalendarDayButton
              {...props}
              className={cn(
                "relative",
                has && "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:bg-primary"
              )}
            />
          )
        },
      }}
    />
  )
}
