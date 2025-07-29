import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function BookingForm({ open, onOpenChange, selectedSlot }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Book Time Slot</SheetTitle>
          <SheetDescription>
            Booking for:{" "}
            <strong>
              {selectedSlot?.day} @ {selectedSlot?.slot}
            </strong>
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 py-2">
          <div className="grid gap-3">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Your name" />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="room">Room</Label>
            <Input id="room" placeholder="Meeting Room" />
          </div>
        </div>
        <SheetFooter className="mt-4">
          <Button type="submit" variant="sunnyStyle">Save</Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}