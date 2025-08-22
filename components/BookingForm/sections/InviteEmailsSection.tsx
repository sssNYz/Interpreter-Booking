import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, X, Plus } from "lucide-react";

interface InviteEmailsSectionProps {
  inviteEmails: string[];
  newEmail: string;
  setNewEmail: (value: string) => void;
  addInviteEmail: () => void;
  removeInviteEmail: (email: string) => void;
  isValidEmail: (email: string) => boolean;
}

export function InviteEmailsSection({
  inviteEmails,
  newEmail,
  setNewEmail,
  addInviteEmail,
  removeInviteEmail,
  isValidEmail,
}: InviteEmailsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Invite Participants
      </h3>

      <div className="flex gap-2">
        <Input
          placeholder="email@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addInviteEmail()}
        />
        <Button type="button" variant="outline" size="sm" onClick={addInviteEmail} disabled={!newEmail || !isValidEmail(newEmail)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {inviteEmails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {inviteEmails.map((email, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {email}
              <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeInviteEmail(email)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}


