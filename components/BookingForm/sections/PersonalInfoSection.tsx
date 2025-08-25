import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone } from "lucide-react";
import type { OwnerGroup } from "@/types/booking";

interface PersonalInfoSectionProps {
  ownerName: string;
  ownerSurname: string;
  ownerEmail: string;
  ownerTel: string;
  ownerGroup: OwnerGroup;
  errors: Record<string, string>;
  onGroupChange: (value: OwnerGroup) => void;
}

export function PersonalInfoSection({
  ownerName,
  ownerSurname,
  ownerEmail,
  ownerTel,
  ownerGroup,
  errors,
  onGroupChange,
}: PersonalInfoSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">
        Personal Information
      </h2>

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
            placeholder="0123456789" 
            value={ownerTel} 
            readOnly 
            className="bg-muted cursor-not-allowed" 
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
            Department
          </Label>
          <Select value={ownerGroup} onValueChange={(v: OwnerGroup) => onGroupChange(v)}>
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


