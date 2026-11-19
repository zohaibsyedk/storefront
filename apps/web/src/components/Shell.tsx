"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBusiness } from "@/lib/api";
import { STATUS_WORD } from "./ui";

function Chat({ id, onClose }: { id: string; onClose: () => void }) {
  const { view, act, busy } = useBusiness(id);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const msgs = view?.state.chat ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const send = async (t: string) => {
    if (!t.trim()) return;
    setText("");
    await act("chat", { text: t });
  };
  const starters = ["How are we doing?", "Why did you make the last change?", "Stop advertising on Sundays"];
  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l-[1.5px] border-ink bg-white" role="dialog" aria-label="Ask your marketer">
      <div className="flex items-center justify-between border-b-[1.5px] border-line px-4 py-3">
        <h2 className="text-xl">Ask your marketer</h2>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div>
            <p className="text-muted">Ask how things are going, why something changed, or tell it what to adjust.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "owner" ? "ml-10 rounded-xl rounded-br-sm bg-blue px-3 py-2 text-white" : "mr-6 rounded-xl rounded-bl-sm bg-sky px-3 py-2"}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.applied && <p className="mt-1"><span className="tag tag-leaf">Done: {m.applied}</span></p>}
          </div>
        ))}
        {busy === "chat" && <p className="hint">Thinking</p>}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t-[1.5px] border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input ref={input} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question or a change" aria-label="Message" />
        <button className="btn" disabled={busy === "chat"}>
          Send
        </button>
      </form>
    </aside>
  );
}

export function Shell({ id, children }: { id: string; children: React.ReactNode }) {
  const path = usePathname();
  const { view, refresh } = useBusiness(id);
  const [chat, setChat] = useState(false);
  useEffect(() => {
    void refresh();
  }, [path, refresh]);
  const status = view?.state.status;
  const name = view?.state.profiles.at(-1)?.basics.name ?? view?.state.draft.basics?.name ?? "";
  const launched = status === "live" || status === "stopped" || status === "completed";
  const tabs = [
    { href: `/b/${id}/plan`, label: "Plan", show: true },
    { href: `/b/${id}/launch`, label: "Launch", show: status === "approved" },
    { href: `/b/${id}/dashboard`, label: "Dashboard", show: launched },
    { href: `/b/${id}/activity`, label: "Activity", show: !!view && view.state.actions.length > 0 },
    { href: `/b/${id}/wallet`, label: "Wallet", show: !!view?.state.wallet },
  ].filter((t) => t.show);
  return (
    <div className="pb-24">
      <div className="awning awning-sm" />
      <header className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-6">
        <Link href="/" className="display text-lg text-blue">
          Storefront
        </Link>
        <span className="font-bold">{name}</span>
        {status && <span className={`tag ${status === "live" ? "tag-leaf" : status === "stopped" ? "tag-brick" : "tag-gold"}`}>{STATUS_WORD[status]}</span>}
        <span className="flex-1" />
        {view && view.state.plans.length > 0 && (
          <button className="btn btn-gold min-h-10 px-3 text-base" onClick={() => setChat(true)}>
            Ask your marketer
          </button>
        )}
      </header>
      <nav className="mx-auto mt-4 flex max-w-5xl gap-1 overflow-x-auto px-5" aria-label="Sections">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className={`rounded-t-lg px-4 py-2 font-bold ${path === t.href ? "bg-white text-ink" : "text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mx-auto max-w-5xl px-5">
        <div className="rounded-b-[14px] rounded-tr-[14px] bg-white/0">{children}</div>
      </div>
      {chat && (
        <>
          <button className="fixed inset-0 z-20 bg-ink/40" aria-label="Close chat" onClick={() => setChat(false)} />
          <Chat id={id} onClose={() => setChat(false)} />
        </>
      )}
    </div>
  );
}
