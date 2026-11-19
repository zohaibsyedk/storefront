# ADR-0003: Local-first storage and workflow runner for the MVP

Status: accepted for the hackathon build (2026-11-19)

The brief names Supabase/Postgres + Drizzle and Inngest. No accounts or keys exist yet, and the deadline is one day. The MVP stores one JSON document per business behind `store.ts` (`loadBusiness`, `saveBusiness`, `withBusiness`) and runs the daily loop on demand (`runDays`).

The functions are written as idempotent steps with a per-business lock, so the migration path is direct: `withBusiness` → Inngest function with `concurrency: { key: event.data.businessId }`; `runDay` → cron step; `approvePlan` wait → `step.waitForEvent`. The document maps onto the section 14 tables.
