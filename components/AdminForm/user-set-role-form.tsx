"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Shield, Languages, Info, Globe } from "lucide-react";

import type { Role, UserSummary, Language, InterpreterLanguage } from "@/types/user";

interface UserRoleDialogProps {
  user: UserSummary;
  /** ถ้าส่งมา จะใช้แทนการยิง API ภายในคอมโพเนนต์ */
  onSave?: (roles: Role[]) => Promise<void> | void;
  trigger?: ReactNode;
}

const ROLE_META: Record<
  Role,
  { label: string; desc: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ADMIN: {
    label: "ADMIN",
    desc: "Full access to manage users and system settings.",
    icon: Shield,
  },
  INTERPRETER: {
    label: "INTERPRETER",
    desc: "Can view booking plans and handle interpretation tasks.",
    icon: Languages,
  },
};

export function UserRoleDialog({ user, onSave, trigger }: UserRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>(user.roles ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Language selection state
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  // Fetch available languages
  const fetchLanguages = async () => {
    try {
      setLoadingLanguages(true);
      const res = await fetch('/api/language', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch languages (${res.status})`);
      const languages: Language[] = await res.json();
      setAvailableLanguages(languages.filter(lang => lang.isActive));
    } catch (err) {
      console.error('Error fetching languages:', err);
      setError('Failed to load languages');
    } finally {
      setLoadingLanguages(false);
    }
  };

  // Fetch current interpreter languages
  const fetchInterpreterLanguages = useCallback(async () => {
    try {
      const res = await fetch(`/api/interpreter-language?empCode=${encodeURIComponent(user.empCode)}`, { 
        cache: 'no-store' 
      });
      if (!res.ok) return;
      const languages: InterpreterLanguage[] = await res.json();
      setSelectedLanguages(languages.map(lang => lang.languageCode));
    } catch (err) {
      console.error('Error fetching interpreter languages:', err);
    }
  }, [user.empCode]);

  // Save interpreter languages
  const saveInterpreterLanguages = async (languageCodes: string[]) => {
    const promises = [];
    
    // Remove languages that are no longer selected
    const currentLanguages = user.languages || [];
    const toRemove = currentLanguages
      .filter(lang => !languageCodes.includes(lang.languageCode))
      .map(lang => lang.languageCode);
    
    for (const langCode of toRemove) {
      promises.push(
        fetch(`/api/interpreter-language?empCode=${encodeURIComponent(user.empCode)}&languageCode=${encodeURIComponent(langCode)}`, {
          method: 'DELETE',
          cache: 'no-store'
        })
      );
    }
    
    // Add new languages
    const toAdd = languageCodes.filter(langCode => 
      !currentLanguages.some(lang => lang.languageCode === langCode)
    );
    
    for (const langCode of toAdd) {
      promises.push(
        fetch('/api/interpreter-language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            empCode: user.empCode, 
            languageCode: langCode 
          }),
          cache: 'no-store'
        })
      );
    }
    
    await Promise.all(promises);
  };

  // ยิง PUT ไป API (กัน html/404, กัน cache dev)
const saveRolesViaAPI = async (nextRoles: Role[]) => {
  const res = await fetch(`/api/user/put-user-role/${encodeURIComponent(String(user.id))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ roles: nextRoles }),
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
    throw new Error(`(${res.status}) ${text.slice(0, 200)}`);
  }
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Unexpected non-JSON response: ${text.slice(0, 200)}`);
  }
  return res.json();
};


  // reset ค่า roles ทุกครั้งที่เปิด dialog หรือ user เปลี่ยน
  useEffect(() => {
    if (open) {
      setRoles(user.roles ?? []);
      // Load languages when dialog opens
      fetchLanguages();
      // Load current interpreter languages if user is already an interpreter
      if (user.roles?.includes('INTERPRETER')) {
        fetchInterpreterLanguages();
      } else {
        setSelectedLanguages([]);
      }
    }
  }, [open, user, fetchInterpreterLanguages]);

  // ใช้เปรียบเทียบก่อน/หลัง
  const initial = useMemo(() => JSON.stringify(user.roles ?? []), [user]);
  const dirty = useMemo(() => JSON.stringify(roles) !== initial, [roles, initial]);

  const toggleRole = (role: Role) => {
    setRoles((prev) => {
      const newRoles = prev.includes(role) 
        ? prev.filter((r) => r !== role) 
        : [...prev, role];
      
      // If removing INTERPRETER role, clear selected languages
      if (role === 'INTERPRETER' && !newRoles.includes('INTERPRETER')) {
        setSelectedLanguages([]);
      }
      // If adding INTERPRETER role, load current languages
      else if (role === 'INTERPRETER' && newRoles.includes('INTERPRETER')) {
        fetchInterpreterLanguages();
      }
      
      return newRoles;
    });
  };

  // กด Save -> ใช้ onSave ถ้ามี, ไม่งั้นยิง API เอง
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save roles first
      if (onSave) {
        await onSave(roles);
      } else {
        const data = await saveRolesViaAPI(roles);
        // ถ้า API คืน roles มาก็ sync state ให้ตรง
        if (Array.isArray(data?.roles)) setRoles(data.roles as Role[]);
      }

      // Save interpreter languages if INTERPRETER role is selected
      if (roles.includes('INTERPRETER')) {
        await saveInterpreterLanguages(selectedLanguages);
      }

      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save roles. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    const code = user.empCode?.slice(0, 2)?.toUpperCase() || "US";
    return code;
  }, [user.empCode]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" type="button">
            Edit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header area with user summary */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg">Set user roles</DialogTitle>
            <DialogDescription>Manage the permissions for this user.</DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-slate-200 text-slate-700 font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {user.empCode}
                {user.email ? ` • ${user.email}` : ""}
              </div>
              {/* ใช้ roles จาก state เพื่อโชว์ค่าปัจจุบัน */}
              {roles.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <Badge
                      key={r}
                      variant="secondary"
                      className={r === "ADMIN" ? "border-green-300" : "border-amber-300"}
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">No roles assigned</div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Body: role options */}
        <div className="px-6 py-4 space-y-3">
          {(Object.keys(ROLE_META) as Role[]).map((r) => {
            const Meta = ROLE_META[r];
            const Icon = Meta.icon;
            const checked = roles.includes(r);
            return (
              <label
                key={r}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleRole(r)}
                  className="mt-0.5"
                  aria-label={`Toggle role ${Meta.label}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{Meta.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{Meta.desc}</p>
                </div>
              </label>
            );
          })}

          {/* Language Selection for INTERPRETER role */}
          {roles.includes('INTERPRETER') && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Languages</Label>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Select languages this interpreter can translate
              </div>
              
              {loadingLanguages ? (
                <div className="text-sm text-muted-foreground">Loading languages...</div>
              ) : availableLanguages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No languages available</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {availableLanguages.map((language) => (
                    <label
                      key={language.id}
                      className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 transition cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedLanguages.includes(language.code)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLanguages(prev => [...prev, language.code]);
                          } else {
                            setSelectedLanguages(prev => prev.filter(code => code !== language.code));
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{language.name}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {selectedLanguages.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedLanguages.map((langCode) => {
                    const language = availableLanguages.find(lang => lang.code === langCode);
                    return (
                      <Badge key={langCode} variant="secondary" className="text-xs">
                        {language?.name || langCode}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-1 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <Info className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
