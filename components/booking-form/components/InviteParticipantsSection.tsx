import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, X } from "lucide-react";
import { FormData } from "../types";

type InviteParticipantsSectionProps = {
  formData: FormData;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  addInviteEmail: () => void;
  removeInviteEmail: (email: string) => void;
  isValidEmail: (email: string) => boolean;
};

export function InviteParticipantsSection({
  formData,
  updateField,
  addInviteEmail,
  removeInviteEmail,
  isValidEmail,
}: InviteParticipantsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Invite Participants
      </h3>

      <div className="flex gap-2">
        <Input
          placeholder="email@example.com"
          value={formData.newEmail}
          onChange={(e) => updateField("newEmail", e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addInviteEmail()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addInviteEmail}
          disabled={!formData.newEmail || !isValidEmail(formData.newEmail)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {formData.inviteEmails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formData.inviteEmails.map((email, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {email}
              <X
                className="h-3 w-3 cursor-pointer hover:text-red-500"
                onClick={() => removeInviteEmail(email)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
