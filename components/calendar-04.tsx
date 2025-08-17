"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"

type Calendar04Props = {
  value?: DateRange | undefined
  onChange?: (range: DateRange | undefined) => void
  defaultFrom?: Date
  defaultTo?: Date
  className?: string
}

export default function Calendar04({
  value,
  onChange,
  defaultFrom,
  defaultTo,
  className,
}: Calendar04Props) {
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(
    defaultFrom || defaultTo
      ? { from: defaultFrom, to: defaultTo }
      : undefined
  )

  const selectedRange = value === undefined ? internalRange : value

  const handleSelect = (next: DateRange | undefined) => {
    onChange?.(next)
    if (value === undefined) setInternalRange(next)
  }

  return (
    <Calendar
      mode="range"
      defaultMonth={selectedRange?.from}
      selected={selectedRange}
      onSelect={handleSelect}
      className={"rounded-lg border shadow-sm " + (className || "")}
    />
  )
}
