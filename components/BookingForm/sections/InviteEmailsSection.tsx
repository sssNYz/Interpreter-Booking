import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, X, Plus, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EmailCheck = { email: string; valid: boolean; reasons: string[] };

interface InviteEmailsSectionProps {
  inviteEmails: string[];
  newEmail: string;
  setNewEmail: (value: string) => void;
  addInviteEmail: () => void;
  removeInviteEmail: (email: string) => void;
  isValidEmail: (email: string) => boolean;
  addMultipleEmails: (emails: string[]) => {
    added: string[];
    invalid: EmailCheck[];
    duplicates: string[];
  };
}

export function InviteEmailsSection({
  inviteEmails,
  newEmail,
  setNewEmail,
  addInviteEmail,
  removeInviteEmail,
  isValidEmail,
  addMultipleEmails,
}: InviteEmailsSectionProps) {
  const [invalidEmails, setInvalidEmails] = useState<EmailCheck[]>([]);

  const submitEmails = () => {
    const raw = newEmail.trim();
    if (!raw) return;

    const emails = raw
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    // If user entered a single email and the old single-add flow is fine, allow it
    if (emails.length === 1 && isValidEmail(emails[0])) {
      addInviteEmail();
      setInvalidEmails([]);
      return;
    }

    const results = addMultipleEmails(emails);
    setInvalidEmails(results.invalid);
    setNewEmail("");
  };



  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Invite Participants
      </h2>

      <div className="space-y-2">
        <Label htmlFor="newEmail" className="text-sm font-medium text-foreground">
          Add Participant Email(s) <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            onClick={submitEmails}
            disabled={!newEmail.trim()}
            aria-label="Add email(s) to invite list"
            className="h-9 w-9 rounded-full bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Input
            id="newEmail"
            type="text"
            placeholder="john@company.com, jane@company.com sarah@company.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && submitEmails()}
            className="flex-1"
            aria-describedby="email-help"
          />
        </div>
        <p id="email-help" className="text-xs text-muted-foreground">
          Enter one or many emails separated by commas or spaces, then press Enter or click +
        </p>
      </div>

      {invalidEmails.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Invalid email(s):</span>
            <div className="mt-2 space-y-1">
              {invalidEmails.map((item, index) => (
                <div key={index} className="text-sm">
                  <code className="bg-destructive/20 px-1 py-0.5 rounded">{item.email}</code>
                  {item.reasons?.length > 0 && (
                    <span className="ml-1 text-muted-foreground">– {item.reasons.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

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


