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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Invite Participants
      </h2>

      <div className="space-y-2">
        <Label htmlFor="newEmail" className="text-sm font-medium text-foreground">
          Add Participant Email <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="newEmail"
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addInviteEmail()}
            className="flex-1"
            aria-describedby="email-help"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addInviteEmail} 
            disabled={!newEmail || !isValidEmail(newEmail)}
            aria-label="Add email to invite list"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p id="email-help" className="text-xs text-muted-foreground">
          Press Enter or click + to add email to the list
        </p>
      </div>

      {inviteEmails.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Invited Participants ({inviteEmails.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {inviteEmails.map((email, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                <span className="text-sm">{email}</span>
                <button
                  type="button"
                  onClick={() => removeInviteEmail(email)}
                  className="ml-1 hover:text-destructive transition-colors"
                  aria-label={`Remove ${email} from invite list`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


