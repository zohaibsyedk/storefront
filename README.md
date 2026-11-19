# Storefront

Marketing for small businesses, run by an agent. The owner answers a short wizard once. The agent drafts a launch plan: Google and Meta campaigns with several ad variations, a website with domain options, and a Google Business Profile. The owner approves it in one place. Then the agent buys the domain, publishes the site, funds a USDC wallet, gives a card an on-chain spending limit, launches the ads, and keeps moving money toward what works, explaining every change.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

On the first screen, "Fill in an example bakery" skips to the review. On the dashboard, "Run 7 days" / "Run 30 days" moves the simulated ad market forward.

```bash
npm run demo           # whole flow in the terminal
npm test               # money invariants, flow, optimizer regret report
npm run e2e            # browser test on phone and desktop sizes
```

On a real Solana validator (SPL Token program, test USDC):

```bash
npm run chain:local                        # terminal 1
STOREFRONT_CHAIN=localnet npm run dev      # terminal 2
```

## What is real and what is simulated

| Part | Status |
|---|---|
| Wizard, plan, change requests with diffs, approval → mandate | Real |
| Budget pacing, mandate checks, ledger, reconciliation, kill switch | Real, property-tested |
| Optimizer (Bayesian estimates, bounded Thompson allocation, guards) | Real, tested against a simulated market |
| USDC wallet + card spending limit | Real SPL Token program on a local validator or devnet (test USDC), or in-memory mock |
| Ad platforms, card issuer, registrar, payment processor | Simulated behind interfaces |
| Ad copy, change requests, chat | Deterministic by default; Claude when a key or the Claude CLI is configured |

See `CLAUDE.md`, `docs/adr/`, `docs/integrations/`, `docs/compliance.md` and `docs/runbooks/owner-setup.md`.
