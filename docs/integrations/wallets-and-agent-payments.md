# Agent wallet options: Solana Agent Kit, Circle Agent Wallets, x402

Checked 2026-11-19 (Circle docs pages + secondary sources). Re-verify before building.

## Circle Agent Wallets (Agent Stack, launched May 2026)

- An agent holds and spends USDC within spending policies (caps on outbound transfers and x402 payments, time-bound limits). Operated through the Circle CLI; built on user-controlled wallets with 2-of-2 MPC, key shares not exposed to the agent.
- Policies apply to **mainnet agent wallets only**, per Circle docs. Chain support listed in what we read is EVM-centric (USDC, EURC, ERC-20, native ETH/MATIC). **Solana support for Agent Wallets is unconfirmed**; Circle's developer-controlled wallets do support Solana.
- Fit: a strong option for the "wallet belongs to the agent" requirement if we use an EVM chain the card issuer supports (Bridge lists Base). Spending policies give a second, provider-side cap on top of the card allowance.

## Solana Agent Kit

- TypeScript toolkit that wraps Solana actions as agent tools. Useful for the treasury plugin (balance, SPL approve/revoke, transfers). Per ADR-0004 the LLM does not get money tools, so SAK would be used as a library called by deterministic Treasurer code, not exposed to the model.

## x402

- HTTP 402-based protocol for paying APIs per request in USDC; SDK `@x402/svm` on Solana. Ad platforms do not take x402, so it cannot pay for ads.
- Good fit for the **20% running-cost reserve**: the agent could pay model/API providers per call via x402 from its wallet, making running costs fully on-chain and auditable. Revisit once a model provider we use accepts x402.

## Recommendation

Phase 1 (real money): one Solana USDC token account per business, held by the platform's agent signer (KMS/MPC, e.g. Circle developer-controlled wallets or Turnkey), with the Bridge card's delegate PDA as the only SPL delegate. Phase 2: evaluate Circle Agent Wallets on Base if Solana is unsupported, to add provider-enforced spending policies.
