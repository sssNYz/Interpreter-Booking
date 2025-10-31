import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, User } from "lucide-react";
import type { OwnerGroup } from "@/types/booking";

interface PersonalInfoSectionProps {
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  onTelChange: (value: string) => void;
  ownerGroup: OwnerGroup;
  errors: Record<string, string>;
  onGroupChange: (value: OwnerGroup) => void;
  openDropdown?: string | null;
  setOpenDropdown?: (value: string | null) => void;
}

export function PersonalInfoSection({
  ownerName,
  ownerSurname,
  ownerEmail,
  ownerTel,
  onTelChange,
  ownerGroup,
  errors,
  onGroupChange,
  openDropdown,
  setOpenDropdown,
}: PersonalInfoSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <User className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ownerName" className="text-sm font-medium text-foreground">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input 
            id="ownerName" 
            placeholder="Your first name" 
            value={ownerName} 
            readOnly 
            className="bg-muted cursor-not-allowed" 
            aria-describedby={errors.ownerName ? "ownerName-error" : undefined}
          />
          {errors.ownerName && (
            <p id="ownerName-error" className="text-destructive text-sm" role="alert">
              {errors.ownerName}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerSurname" className="text-sm font-medium text-foreground">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input 
            id="ownerSurname" 
            placeholder="Your last name" 
            value={ownerSurname} 
            readOnly 
            className="bg-muted cursor-not-allowed" 
            aria-describedby={errors.ownerSurname ? "ownerSurname-error" : undefined}
          />
          {errors.ownerSurname && (
            <p id="ownerSurname-error" className="text-destructive text-sm" role="alert">
              {errors.ownerSurname}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerEmail" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="h-4 w-4" />
          Email <span className="text-destructive">*</span>
        </Label>
        <Input 
          id="ownerEmail" 
          type="email" 
          placeholder="your.email@example.com" 
          value={ownerEmail} 
          readOnly 
          className="bg-muted cursor-not-allowed" 
          aria-describedby={errors.ownerEmail ? "ownerEmail-error" : undefined}
        />
        {errors.ownerEmail && (
          <p id="ownerEmail-error" className="text-destructive text-sm" role="alert">
            {errors.ownerEmail}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ownerTel" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Phone className="h-4 w-4" />
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input 
            id="ownerTel" 
            type="tel"
            placeholder="1234" 
            value={ownerTel} 
            maxLength={4}
            inputMode="numeric"
            readOnly
            className="bg-muted cursor-not-allowed"
            onChange={(e) => onTelChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            aria-describedby={errors.ownerTel ? "ownerTel-error" : undefined}
          />
          {errors.ownerTel && (
            <p id="ownerTel-error" className="text-destructive text-sm" role="alert">
              {errors.ownerTel}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerGroup" className="text-sm font-medium text-foreground">
            <HoverCard openDelay={1000}>
              <HoverCardTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-flex underline-offset-4 decoration-muted-foreground/70 hover:underline focus-visible:underline outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                >
                  Department
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="flex justify-between gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src="/avatar-placeholder.svg" />
                    <AvatarFallback>DP</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Department</h4>
                    <p className="text-sm text-muted-foreground">
                      Your department or team that hosts the meeting.
                    </p>
                
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </Label>
          <Select 
            value={ownerGroup} 
            onValueChange={(v: OwnerGroup) => onGroupChange(v)}
            open={openDropdown === "department"}
            onOpenChange={(open) => setOpenDropdown?.(open ? "department" : null)}
          >
            <SelectTrigger id="ownerGroup" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="software">Software</SelectItem>
              <SelectItem value="iot">IoT</SelectItem>
              <SelectItem value="hardware">Hardware</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

