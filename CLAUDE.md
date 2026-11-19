# Storefront

An AI marketing agency in a box for small US businesses. The owner fills in a wizard once, the agent drafts a launch plan, the owner approves it, and the agent runs ads (Google, Meta), a website and listings inside the approved mandate, paying for ads from USDC.

## Commands

```bash
npm install
npm run dev          # web app on http://localhost:3000 (all external systems mocked)
npm run demo         # headless run of the whole flow: onboard → plan → change → approve → launch → 30 days → kill switch
npm test             # vitest: money invariants (property-based), flow, optimizer regret report
npm run e2e          # Playwright: the MVP flow on phone (360px) and desktop, against a production build
npm run typecheck && npm run lint

# Real SPL Token program instead of the in-memory chain:
npm run chain:local                          # terminal 1: local Solana validator
STOREFRONT_CHAIN=localnet npm run dev        # terminal 2 (or: npm run demo:solana)
SOLANA_LOCALNET=1 npm test                   # includes the on-chain test
# Devnet: STOREFRONT_CHAIN=devnet; fund the fee payer printed in the error at https://faucet.solana.com
```

Run `npm run typecheck && npm run lint && npm test` before every commit.

## Layout

- `packages/core` — domain types, zod schemas (one per wizard step, reused by the agent), `Micro` money (integer micro-USDC), categories, seeded RNG.
- `packages/treasury` — double-entry ledger, `Chain` interface (`MockChain` in memory; `SolanaChain` on devnet/localnet with a 6-decimal test USDC mint, platform key pays fees, keys under `.data/keys`), Treasurer (allowance sizing, billing, reconciliation, invariants, kill switch). Deterministic code, no LLM.
- `packages/market` — simulated ad market with hidden true rates, learning phases, platform delivery optimisation, overdelivery.
- `packages/optimizer` — Bayesian estimates (Beta-Binomial × Gamma), Thompson-style bounded allocation, pause rule, anomaly detection.
- `packages/agent` — store, LLM provider, plan drafting, change requests → structured patches, mandate checks, execution workflow, daily engine, dashboard curation, chat, fixtures.
- `apps/web` — Next.js 16 App Router. `/onboarding/[id]`, `/b/[id]/{plan,launch,dashboard,activity,wallet}`, `/sites/[id]` (generated site), `/api/b/[id]` (one POST endpoint with `action`).

## Rules that matter

- Money is always integer micro-USDC (`Micro`). Never floats for balances. Every money movement posts a balanced ledger entry.
- The LLM never touches money, targeting or budgets. It may only rewrite copy, classify chat intents and interpret change requests into `planPatchSchema`; output must pass the zod schema plus lint/policy checks or the deterministic ("house") result is used.
- Free text from owners, reviews or pages is data, passed via `asData()`, never instructions.
- Offers, discounts, claims, budget increases and new platforms always need owner approval (`needsApproval` / approval task). Chat and change requests can never apply them.
- Kill switch order: pause → shrink allowance to what is owed → pay final bill → revoke → freeze. Never revoke before paying for delivered ads.
- All work on one business is serialised through `withBusiness()` (stand-in for an Inngest concurrency key).
- Next.js here is v16: route `params` are Promises; read `node_modules/next/dist/docs` before using an unfamiliar API.

## Model access

`ANTHROPIC_API_KEY` set → Anthropic API. `STOREFRONT_LLM=claude-cli` → local `claude -p`. Otherwise "house" mode (deterministic writers). Tests force house mode.

## Data

Local state is JSON under `.data/` (one file per business, uploads under `.data/uploads`). `STOREFRONT_DATA_DIR` overrides. See ADR-0003 for the Postgres plan.

## Decisions

See `docs/adr/`. Integration research is in `docs/integrations/`, legal questions in `docs/compliance.md`.
