"use client";

import { Flame, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Nav } from "@/components/nav";

const KEY = "forge.sidebar.collapsed";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore persisted state after mount (avoids hydration mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(KEY) === "1");
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      } ${ready ? "" : "opacity-0"}`}
    >
      <div
        className={`flex items-center py-4 ${collapsed ? "justify-center px-0" : "gap-2.5 px-5"}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Flame className="size-4.5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-heading text-lg font-semibold leading-tight tracking-tight">
              forge
            </div>
            <div className="truncate text-[11px] text-muted-foreground">VideoDB Growth Agent</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <Nav collapsed={collapsed} />
      </div>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground ${
            collapsed ? "justify-center px-0" : "gap-2.5"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4.5 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4.5 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
        {!collapsed && (
          <div className="px-3 pb-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Human-approved, always
            </p>
            <p className="mt-1">No public action posts without a reviewer.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
