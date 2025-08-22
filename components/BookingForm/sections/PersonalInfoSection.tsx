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
    <div className="space-y-4">
      <h3 className="flex text-lg font-semibold border-b pb-2 ml-auto">Personal Information</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ownerName">First Name *</Label>
          <Input id="ownerName" placeholder="Your first name" value={ownerName} readOnly className="bg-muted cursor-not-allowed" />
          {errors.ownerName && <p className="text-red-500 text-sm">{errors.ownerName}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ownerSurname">Last Name *</Label>
          <Input id="ownerSurname" placeholder="Your last name" value={ownerSurname} readOnly className="bg-muted cursor-not-allowed" />
          {errors.ownerSurname && <p className="text-red-500 text-sm">{errors.ownerSurname}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ownerEmail" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email *
        </Label>
        <Input id="ownerEmail" type="email" placeholder="your.email@example.com" value={ownerEmail} readOnly className="bg-muted cursor-not-allowed" />
        {errors.ownerEmail && <p className="text-red-500 text-sm">{errors.ownerEmail}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ownerTel" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone *
          </Label>
          <Input id="ownerTel" placeholder="0123456789" value={ownerTel} readOnly className="bg-muted cursor-not-allowed" />
          {errors.ownerTel && <p className="text-red-500 text-sm">{errors.ownerTel}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ownerGroup">Department</Label>
          <Select value={ownerGroup} onValueChange={(v: OwnerGroup) => onGroupChange(v)}>
            <SelectTrigger>
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


