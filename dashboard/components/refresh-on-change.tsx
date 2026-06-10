"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { onChange } from "@/lib/realtime";

/** Re-renders the server component tree when matching NOTIFY events arrive. */
export function RefreshOnChange({ tables }: { tables?: string[] }) {
  const router = useRouter();
  const tablesKey = tables?.join(",");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onChange(() => {
      // debounce bursts — one refresh per 500ms window
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, 500);
    }, tablesKey ? tablesKey.split(",") : undefined);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [router, tablesKey]);
  return null;
}
