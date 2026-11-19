"use client";
import { fmtUsd, type Micro } from "@storefront/core";
import type { ReactNode } from "react";

export function Usd({ v, cents = true, className = "" }: { v: Micro; cents?: boolean; className?: string }) {
  return <span className={`num ${className}`}>{fmtUsd(v, { cents })}</span>;
}

export function Receipt({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`receipt ${className}`}>
      {title && <h3 className="mb-2">{title}</h3>}
      {children}
    </div>
  );
}
export function Row({ label, value, note, total, strong }: { label: ReactNode; value: ReactNode; note?: ReactNode; total?: boolean; strong?: boolean }) {
  return (
    <div className={total ? "receipt-total" : ""}>
      <div className={`receipt-row ${strong ? "font-bold" : ""}`}>
        <span>{label}</span>
        <span className="dots" aria-hidden />
        <span className="num">{value}</span>
      </div>
      {note && <p className="hint -mt-1 mb-1">{note}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg border-[1.5px] border-brick bg-brick-soft px-3 py-2 text-brick">
      {children}
    </p>
  );
}

export function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return <p className="p-6 text-muted">{what}…</p>;
}

export const STATUS_WORD: Record<string, string> = {
  onboarding: "Setting up",
  drafting: "Drafting your plan",
  review: "Plan ready to review",
  approved: "Approved, ready to launch",
  live: "Running",
  stopped: "Stopped",
  completed: "Finished",
};
