"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SetupPhonePage() {
  const router = useRouter();
  const [ext, setExt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/user/profile", { cache: "no-store" });
        if (!r.ok) {
          if (r.status === 401) {
            router.replace("/login");
            return;
          }
          throw new Error("profile error");
        }
        const j = await r.json();
        const phone = j?.user?.phone ?? null;
        if (phone) {
          // Already set, go to main
          router.replace("/BookingPage");
          return;
        }
      } catch (e) {
        // If profile fails, still allow input to try saving
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = ext.trim();
    if (!/^\d{4}$/.test(v)) {
      setError("Please enter 4 digits");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/user/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telExt: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j?.message || "Cannot save now");
        return;
      }
      try {
        const raw = localStorage.getItem("booking.user");
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.phone = v;
        localStorage.setItem("booking.user", JSON.stringify(parsed));
        window.dispatchEvent(new StorageEvent("storage", { key: "booking:user-changed" }));
      } catch {}
      toast.success("Saved");
      router.replace("/BookingPage");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-svh w-full flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Set your phone extension</h1>
          <p className="text-sm text-muted-foreground">This is required. 4 digits only.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ext">Extension (4 digits)</Label>
            <Input
              id="ext"
              inputMode="numeric"
              pattern="\\d{4}"
              maxLength={4}
              placeholder="1234"
              value={ext}
              onChange={(e) => setExt(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save and continue"}
          </Button>
        </form>
        <div className="text-center text-xs text-muted-foreground">
          You can update this later in your profile.
        </div>
      </div>
    </div>
  );
}


