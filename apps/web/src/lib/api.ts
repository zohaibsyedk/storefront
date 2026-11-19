"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessView } from "./view";

export type { BusinessView };

export function useBusiness(id: string) {
  const [view, setView] = useState<BusinessView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/b/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!alive.current) return;
    if (!res.ok) setError(data.error ?? "Could not load");
    else setView(data);
  }, [id]);

  useEffect(() => {
    alive.current = true;
    // Load on mount. State is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onRefresh = (e: Event) => {
      const from = (e as CustomEvent<string | undefined>).detail;
      if (!from || from === id) void refresh();
    };
    window.addEventListener("storefront:refresh", onRefresh);
    return () => {
      alive.current = false;
      window.removeEventListener("storefront:refresh", onRefresh);
    };
  }, [refresh, id]);

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}, opts: { quiet?: boolean } = {}): Promise<BusinessView | null> => {
      if (!opts.quiet) setBusy(action);
      setError(null);
      try {
        const res = await fetch(`/api/b/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return null;
        }
        if (alive.current) setView(data);
        // Let other views of the same business (the shell's header and tabs) catch up.
        window.dispatchEvent(new CustomEvent("storefront:refresh", { detail: id }));
        return data as BusinessView;
      } catch {
        setError("We could not reach the server. Check your connection and try again.");
        return null;
      } finally {
        if (!opts.quiet) setBusy(null);
      }
    },
    [id],
  );

  return { view, error, busy, act, refresh, setError };
}
