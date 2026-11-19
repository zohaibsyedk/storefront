"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { STATUS_WORD } from "@/components/ui";

interface Item {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  step: number;
  day: number;
}

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    fetch("/api/businesses", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.businesses))
      .catch(() => setItems([]));
  }, []);
  async function start() {
    setStarting(true);
    const res = await fetch("/api/businesses", { method: "POST" });
    const { id } = await res.json();
    router.push(`/onboarding/${id}`);
  }
  const href = (b: Item) => (b.status === "onboarding" ? `/onboarding/${b.id}` : b.status === "review" ? `/b/${b.id}/plan` : b.status === "approved" ? `/b/${b.id}/launch` : `/b/${b.id}/dashboard`);
  return (
    <main>
      <div className="awning" />
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-12 rise">
        <p className="display text-xl text-blue">Storefront</p>
        <h1 className="mt-3">Tell us about your shop once. We handle the marketing from there.</h1>
        <p className="mt-4 max-w-xl text-lg">
          Answer a few questions. You get a plan to approve: ads on Google, Facebook and Instagram, a website, and your Google listing. After that it runs itself inside the budget you set, and shows you where every dollar went.
        </p>
        <div className="mt-7">
          <button className="btn w-full sm:w-auto" onClick={start} disabled={starting}>
            {starting ? "Opening" : "Set up my business"}
          </button>
          <p className="hint mt-3">About ten minutes. You can stop and pick up later on any device.</p>
        </div>
        {items && items.length > 0 && (
          <section className="mt-12" aria-label="Businesses you already started">
            <h2>Pick up where you left off</h2>
            <ul className="mt-3 divide-y-[1.5px] divide-line rounded-[14px] bg-white">
              {items.map((b) => (
                <li key={b.id}>
                  <Link href={href(b)} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block font-bold">{b.name}</span>
                      <span className="hint">
                        {b.status === "onboarding" ? `Setting up, on step ${Math.min(9, (b.step ?? 0) + 1)} of 9` : b.status === "live" ? `Running, day ${b.day}` : STATUS_WORD[b.status]}
                      </span>
                    </span>
                    <span className="tag">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
