import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone } from "lucide-react";
import { FormData, OwnerGroup } from "../types";

type PersonalInformationSectionProps = {
  formData: FormData;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  errors: Record<string, string>;
};

export function PersonalInformationSection({
  formData,
  updateField,
  errors,
}: PersonalInformationSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex text-lg font-semibold border-b pb-2 ml-auto">
        Personal Information
      </h3>

      {/* Full name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ownerName">First Name *</Label>
          <Input
            id="ownerName"
            placeholder="Your first name"
            value={formData.ownerName}
            onChange={(e) => updateField("ownerName", e.target.value)}
            className={errors.ownerName ? "border-red-500" : ""}
          />
          {errors.ownerName && (
            <p className="text-red-500 text-sm">{errors.ownerName}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ownerSurname">Last Name *</Label>
          <Input
            id="ownerSurname"
            placeholder="Your last name"
            value={formData.ownerSurname}
            onChange={(e) => updateField("ownerSurname", e.target.value)}
            className={errors.ownerSurname ? "border-red-500" : ""}
          />
          {errors.ownerSurname && (
            <p className="text-red-500 text-sm">{errors.ownerSurname}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ownerEmail" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email *
        </Label>
        <Input
          id="ownerEmail"
          type="email"
          placeholder="your.email@example.com"
          value={formData.ownerEmail}
          onChange={(e) => updateField("ownerEmail", e.target.value)}
          className={errors.ownerEmail ? "border-red-500" : ""}
        />
        {errors.ownerEmail && (
          <p className="text-red-500 text-sm">{errors.ownerEmail}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ownerTel" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone *
          </Label>
          <Input
            id="ownerTel"
            placeholder="0123456789"
            value={formData.ownerTel}
            onChange={(e) => updateField("ownerTel", e.target.value)}
            className={errors.ownerTel ? "border-red-500" : ""}
          />
          {errors.ownerTel && (
            <p className="text-red-500 text-sm">{errors.ownerTel}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ownerGroup">Department</Label>
          <Select
            value={formData.ownerGroup}
            onValueChange={(value) =>
              updateField("ownerGroup", value as OwnerGroup)
            }
          >
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
