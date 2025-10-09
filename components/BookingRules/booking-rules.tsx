"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Scale, 
  Calendar, 
  Clock, 
  XCircle, 
  Users, 
  RefreshCw, 
  FileText,
  User,
  DoorClosed,
  ShieldAlert
} from "lucide-react";

export default function BookingRules({ forwardMonthLimit }: { forwardMonthLimit?: number }) {
  const [limit, setLimit] = useState<number>(forwardMonthLimit ?? 1);

  useEffect(() => {
    if (typeof forwardMonthLimit === "number") {
      setLimit(forwardMonthLimit);
      return;
    }
    // fallback fetch when prop not provided
    fetch("/api/policy/forward-limit")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json) => {
        const n = Number(json?.data?.forwardMonthLimit);
        if (Number.isFinite(n) && n >= 0) setLimit(n);
      })
      .catch(() => {});
  }, [forwardMonthLimit]);

  const rules = [
    {
      category: "Booking Time Limits",
      icon: Calendar,
      iconColor: "text-blue-600 dark:text-blue-400",
      items: [
        {
          icon: Calendar,
          iconColor: "text-blue-500",
          text: (
            <>
              You can book <strong>current month + {limit} month{limit === 1 ? "" : "s"}</strong> ahead.
            </>
          ),
        },
        {
          icon: XCircle,
          iconColor: "text-red-500",
          text: (
            <>
              <strong>No booking</strong> on Saturday or Sunday.
            </>
          ),
        },
        {
          icon: Clock,
          iconColor: "text-gray-500",
          text: (
            <>
              <strong>Past time</strong> is disabled.
            </>
          ),
        },
        {
          icon: Users,
          iconColor: "text-orange-500",
          text: (
            <>
              If a time is <strong>full</strong>, you cannot book (all interpreters are busy).
            </>
          ),
        },
        {
          icon: RefreshCw,
          iconColor: "text-purple-500",
          text: (
            <>
              <strong>Repeat bookings</strong> must stay inside the allowed months.
            </>
          ),
        }
      ]
    },
    {
      category: "Meeting Type Rules",
      icon: FileText,
      iconColor: "text-green-600 dark:text-green-400",
      items: [
        {
          icon: FileText,
          iconColor: "text-green-500",
          text: (
            <>
              <strong>DR meeting:</strong> choose DR type. If &quot;Other&quot;, fill &quot;Other type&quot; and &quot;Scope&quot;. Add <strong>Chairman email</strong>.
            </>
          ),
        },
        {
          icon: User,
          iconColor: "text-indigo-500",
          text: (
            <>
              <strong>President meeting:</strong> choose an <strong>Interpreter</strong>.
            </>
          ),
        }
      ]
    },
    {
      category: "Conflict Prevention",
      icon: ShieldAlert,
      iconColor: "text-amber-600 dark:text-amber-400",
      items: [
        {
          icon: DoorClosed,
          iconColor: "text-amber-500",
          text: (
            <>
              <strong>Room</strong> must be free (no room conflict).
            </>
          ),
        },
        {
          icon: User,
          iconColor: "text-rose-500",
          text: (
            <>
              <strong>Chairman</strong> must be free at that time.
            </>
          ),
        },
        {
          icon: Users,
          iconColor: "text-teal-500",
          text: (
            <>
              <strong>Interpreter</strong> must be free at that time.
            </>
          ),
        }
      ]
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="ml-0 bg-neutral-700 text-white rounded-full hover:bg-black/90 w-28 h-10 shadow-md hover:shadow-lg active:shadow-md transition">
          <Scale className="w-20 h-20" />
          Rules
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scale className="w-5 h-5 text-foreground" />
            Booking Rules
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          <Accordion type="multiple" defaultValue={[]} className="w-full mt-2">
            {rules.map((section, idx) => (
              <AccordionItem 
                key={idx} 
                value={idx.toString()}
                className="mb-2 rounded-lg border border-border overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <section.icon className={`w-4 h-4 ${section.iconColor}`} />
                    <h3 className="font-medium text-sm text-foreground">
                      {section.category}
                    </h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-2.5 pt-1">
                    {section.items.map((item, itemIdx) => (
                      <div 
                        key={itemIdx} 
                        className="flex items-start gap-2.5 pl-1"
                      >
                        <item.icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${item.iconColor}`} />
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}