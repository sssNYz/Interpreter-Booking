"use client";

import dynamic from "next/dynamic";

// Lazy-load the heavy AutoAssignConfig UI to keep initial tab light
const AutoAssignConfig = dynamic(() => import("@/components/AdminControls/AutoAssignConfig"), {
  ssr: false,
});

export default function AutoAssignSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <AutoAssignConfig />
    </div>
  );
}


