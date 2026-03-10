"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Stats are shown inline in the main dashboard — redirect there
export default function StatsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-5 h-5 border-2 border-t-amber-500 border-amber-500/20 rounded-full animate-spin" />
    </div>
  );
}
