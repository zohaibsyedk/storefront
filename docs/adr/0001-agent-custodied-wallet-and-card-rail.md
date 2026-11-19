# ADR-0001: Agent-held USDC wallet, card rail behind an interface

Status: accepted (2026-11-19)

## Context

The owner wants the wallet to belong to the agent: owners pay through a normal payment processor, and the agent holds that money as USDC and pays for ads. The original brief assumed an owner-custodied embedded wallet with MoonAgents Card, which is not available to US businesses today.

## Decision

- Owners pay by card through a processor. The platform buys USDC and credits a per-business agent wallet (one Solana token account per business, never pooled).
- A separate card-rail delegate holds an SPL `Approve` allowance on that token account. The allowance is sized to "already owed + rest of this period's cap + small buffer", capped by the mandate. It is the on-chain hard limit on what the card can pull.
- Ad platforms see an ordinary card. The card issuer is behind the `SpendRail`-style boundary (`Chain` + `billDue`); the local build uses `MockChain` and a simulated card.
- Non-ad payments (domain, $20/month subscription, agent running costs) are explicit transfers from the agent wallet to the platform treasury, each with a ledger entry.

## Consequences

- Holding customer funds makes Storefront a custodian and likely a money transmitter. This is the biggest open legal question (docs/compliance.md). Per-business wallets, a strict ledger and daily reconciliation are prerequisites, not a substitute for legal advice.
- No real money moves until an issuer and an on-ramp partner are chosen and counsel signs off.
