"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar as ShadCalendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatYmdFromDate } from "@/utils/time";

type RoleCode = "ADMIN" | "INTERPRETER" | "SUPER_ADMIN";

type MeResponse = {
  ok: boolean;
  empCode: string;
  roles: RoleCode[];
  centers: string[];
  adminEnvIds: number[];
};

type Language = { id: number; code: string; name: string; isActive: boolean };

type Interpreter = {
  empCode: string;
  firstNameEn?: string;
  lastNameEn?: string;
  interpreterLanguages: Array<{ language: { name: string } }>;
};

const ownerGroups = ["iot", "hardware", "software", "other"] as const;
const meetingTypes = ["DR", "VIP", "Weekly", "General", "Urgent", "President", "Other"] as const;
const drTypes = ["DR_PR", "DR_k", "DR_II", "DR_I", "Other"] as const;

function toHms(hhmm: string): string {
  // Convert "HH:mm" -> "HH:mm:00"
  const [h, m] = hhmm.split(":");
  return `${h?.padStart(2, "0")}:${m?.padStart(2, "0")}:00`;
}

type Room = { id: number | string; name: string; location: string | null; capacity?: number; isActive?: boolean };

const Page: React.FC = () => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [interpreters, setInterpreters] = useState<Interpreter[]>([]);
  const [loadingInterpreters, setLoadingInterpreters] = useState(false);

  // Form state
  const [ownerEmpCode, setOwnerEmpCode] = useState("");
  const [ownerGroup, setOwnerGroup] = useState<typeof ownerGroups[number]>("software");
  const [meetingRoom, setMeetingRoom] = useState("");
  const [meetingType, setMeetingType] = useState<typeof meetingTypes[number]>("General");
  const [meetingDetail, setMeetingDetail] = useState("");
  const [applicableModel, setApplicableModel] = useState("");
  const [languageCode, setLanguageCode] = useState<string>("");
  const [drType, setDrType] = useState<string>("");
  const [otherType, setOtherType] = useState<string>("");
  const [chairmanEmail, setChairmanEmail] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [note, setNote] = useState("");

  const [dateYmd, setDateYmd] = useState("");
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [startHm, setStartHm] = useState("");
  const [endHm, setEndHm] = useState("");
  const [interpreterEmpCode, setInterpreterEmpCode] = useState("");

  // Rooms for dropdown (same pattern as user booking)
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomComboboxOpen, setRoomComboboxOpen] = useState(false);

  const isAdmin = useMemo(() => (me?.roles ?? []).includes("ADMIN") || (me?.roles ?? []).includes("SUPER_ADMIN"), [me]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((json: MeResponse) => {
        setMe(json);
        if (json?.empCode) setOwnerEmpCode(json.empCode);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/language?active=true")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((langs: Language[]) => setLanguages(langs))
      .catch(() => setLanguages([]));
  }, []);

  // Fetch rooms for dropdown
  useEffect(() => {
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const r = await fetch("/api/admin/add-room?isActive=true");
        const j = await r.json();
        if (j?.success) setRooms(j.data?.rooms ?? []);
      } catch (e) {
        // noop
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  // Time slots (24h, 30-min increments)
  const startSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      slots.push(`${hh}:00`);
      slots.push(`${hh}:30`);
    }
    return slots; // 00:00 .. 23:30
  }, []);
  const endSlotsAll = useMemo(() => {
    return [...startSlots, "24:00"]; // allow 24:00 as end only
  }, [startSlots]);
  const timeToMinutes = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    return (hh * 60) + (mm || 0);
  };
  const availableEndSlots = useMemo(() => {
    if (!startHm) return endSlotsAll;
    const startMin = timeToMinutes(startHm);
    return endSlotsAll.filter((t) => timeToMinutes(t) > startMin);
  }, [endSlotsAll, startHm]);

  // Convert HH:mm to ISO-like string for availability query; treat 24:00 as next-day 00:00
  const toIsoForQuery = (ymd: string, hhmm: string): string => {
    if (!ymd || !hhmm) return "";
    if (hhmm === "24:00") {
      const [y, m, d] = ymd.split("-").map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      dt.setDate(dt.getDate() + 1);
      const next = formatYmdFromDate(dt);
      return `${next}T00:00:00`;
    }
    return `${ymd}T${hhmm}:00`;
  };

  // Load available interpreters when date/time/lang changes
  useEffect(() => {
    const canQuery = Boolean(dateYmd && startHm && endHm);
    if (!canQuery) {
      setInterpreters([]);
      return;
    }
    const startIso = toIsoForQuery(dateYmd, startHm);
    const endIso = toIsoForQuery(dateYmd, endHm);
    const params = new URLSearchParams();
    if (languageCode) params.set("language", languageCode);
    params.set("timeStart", startIso);
    params.set("timeEnd", endIso);
    setLoadingInterpreters(true);
    fetch(`/api/employees/interpreters?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Interpreter[]) => setInterpreters(data))
      .catch(() => setInterpreters([]))
      .finally(() => setLoadingInterpreters(false));
  }, [dateYmd, startHm, endHm, languageCode]);

  const handleSubmit = async () => {
    try {
      if (!isAdmin) {
        toast.error("You are not authorized");
        return;
      }
      if (!dateYmd || !startHm || !endHm) {
        toast.error("Please select date, start and end time");
        return;
      }
      if (!interpreterEmpCode) {
        toast.error("Please select an interpreter");
        return;
      }
      if (!meetingRoom.trim()) {
        toast.error("Meeting room is required");
        return;
      }
      if (!ownerEmpCode.trim()) {
        toast.error("Owner emp code is required");
        return;
      }
      if (!note.trim()) {
        toast.error("Backfill note is required");
        return;
      }
      const ts = `${dateYmd} ${toHms(startHm)}`;
      const te = `${dateYmd} ${toHms(endHm)}`;
      if (ts >= te) {
        toast.error("End time must be after start time");
        return;
      }

      // Meeting-type required fields
      const payload: Record<string, any> = {
        ownerEmpCode: ownerEmpCode.trim(),
        ownerGroup,
        meetingRoom: meetingRoom.trim(),
        meetingType,
        meetingDetail: meetingDetail || null,
        applicableModel: applicableModel || null,
        languageCode: languageCode || null,
        timeStart: ts,
        timeEnd: te,
        interpreterEmpCode,
        meetingLink: meetingLink || null,
        note: note.trim(),
      };
      if (meetingType === "DR") {
        if (!drType) {
          toast.error("DR type is required for DR meetings");
          return;
        }
        if (!chairmanEmail) {
          toast.error("Chairman email is required for DR meetings");
          return;
        }
        payload.drType = drType;
        payload.chairmanEmail = chairmanEmail;
      } else if (meetingType === "Other") {
        if (!otherType.trim()) {
          toast.error("Other type is required for 'Other' meeting type");
          return;
        }
        payload.otherType = otherType.trim();
        payload.otherTypeScope = "meeting_type";
      }

      const res = await fetch("/api/admin/bookings/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || "Failed to create backfill booking";
        toast.error(msg);
        return;
      }
      toast.success("Backfilled booking created");
      // Reset minimal fields for next entry
      setMeetingDetail("");
      setApplicableModel("");
      setMeetingLink("");
      setNote("");
      setInterpreterEmpCode("");
    } catch (e) {
      toast.error("Unexpected error creating booking");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Admin Backfill</h1>
        <p className="text-sm text-muted-foreground">You must be an admin to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Admin Backfill Booking</h1>
      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Owner Emp Code</label>
            <Input value={ownerEmpCode} onChange={(e) => setOwnerEmpCode(e.target.value)} placeholder="E00001" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Owner Group</label>
            <Select value={ownerGroup} onValueChange={(v) => setOwnerGroup(v as any)}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>
                {ownerGroups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Meeting Room</label>
            <Popover open={roomComboboxOpen} onOpenChange={setRoomComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={roomComboboxOpen}
                  id="meetingRoom"
                  className="w-full justify-between"
                  disabled={loadingRooms}
                >
                  {meetingRoom
                    ? rooms.find((r) => r.name === meetingRoom)?.name
                    : loadingRooms
                    ? "Loading..."
                    : "Select room"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search rooms..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No room found.</CommandEmpty>
                    <CommandGroup>
                      {rooms.map((room) => (
                        <CommandItem
                          key={String(room.id)}
                          value={room.name}
                          onSelect={(currentValue) => {
                            setMeetingRoom(currentValue === meetingRoom ? "" : currentValue);
                            setRoomComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              meetingRoom === room.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{room.name}</span>
                            {room.location && (
                              <span className="text-sm text-muted-foreground">Floor {room.location}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Meeting Type</label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as any)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {meetingTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {meetingType === "DR" && (
            <>
              <div className="grid gap-2">
                <label className="text-sm font-medium">DR Type</label>
                <Select value={drType} onValueChange={setDrType}>
                  <SelectTrigger><SelectValue placeholder="Select DR type" /></SelectTrigger>
                  <SelectContent>
                    {drTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Chairman Email</label>
                <Input type="email" value={chairmanEmail} onChange={(e) => setChairmanEmail(e.target.value)} placeholder="chairman@example.com" />
              </div>
            </>
          )}
          {meetingType === "Other" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Other Type</label>
              <Input value={otherType} onChange={(e) => setOtherType(e.target.value)} placeholder="Workshop, Training..." />
            </div>
          )}

          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Meeting Detail</label>
            <Textarea value={meetingDetail} onChange={(e) => setMeetingDetail(e.target.value)} placeholder="Describe the meeting" rows={3} />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Applicable Model</label>
            <Input value={applicableModel} onChange={(e) => setApplicableModel(e.target.value)} placeholder="Model X" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Language</label>
            <Select value={languageCode} onValueChange={setLanguageCode}>
              <SelectTrigger><SelectValue placeholder="Optional language" /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.id} value={l.code}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-medium">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {dateObj ? dateObj.toLocaleDateString() : "Select date"}
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <ShadCalendar
                  mode="single"
                  selected={dateObj}
                  captionLayout="dropdown"
                  onSelect={(d) => {
                    setDateObj(d ?? undefined);
                    if (d) setDateYmd(formatYmdFromDate(d));
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Start</Label>
            <Select
              value={startHm}
              onValueChange={(v) => {
                setStartHm(v);
                if (endHm && timeToMinutes(endHm) <= timeToMinutes(v)) setEndHm("");
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Start time" /></SelectTrigger>
              <SelectContent>
                {startSlots.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">End</Label>
            <Select value={endHm} onValueChange={setEndHm} disabled={!startHm}>
              <SelectTrigger className="w-full"><SelectValue placeholder="End time" /></SelectTrigger>
              <SelectContent>
                {availableEndSlots.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Meeting Link (optional)</label>
            <Input type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Interpreter (available in range)</label>
            <Select value={interpreterEmpCode} onValueChange={setInterpreterEmpCode} disabled={loadingInterpreters || !(dateYmd && startHm && endHm)}>
              <SelectTrigger><SelectValue placeholder={loadingInterpreters ? "Loading..." : "Select interpreter"} /></SelectTrigger>
              <SelectContent>
                {interpreters.length === 0 && <div className="px-2 py-1 text-sm text-muted-foreground">No interpreters available</div>}
                {interpreters.map((it) => (
                  <SelectItem key={it.empCode} value={it.empCode}>
                    {`${it.firstNameEn || ""} ${it.lastNameEn || ""}`.trim() || it.empCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Backfill Note (required)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you backfilling this booking?" rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-3">
        <Button onClick={handleSubmit}>Create Backfill</Button>
      </div>
    </div>
  );
};

export default Page;
