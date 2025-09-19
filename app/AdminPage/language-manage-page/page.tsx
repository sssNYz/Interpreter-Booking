// app/admin/language-manage/page.tsx
"use client"
import React, { useEffect, useState } from "react";
import LanguageManagement from "@/components/AdminControls/language-manage";

export default function AdminPageLanguageManagement() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/user/me', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!alive) return;
        const roles: string[] = data?.user?.roles || [];
        setAllowed(roles.includes('SUPER_ADMIN'));
      }).catch(() => setAllowed(false));
    return () => { alive = false };
  }, []);

  if (allowed === null) return null;
  if (!allowed) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Forbidden</div>
  );
  return <LanguageManagement />;
}
