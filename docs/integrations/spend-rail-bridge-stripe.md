# Spend rail: Bridge (Stripe) stablecoin-backed cards — recommended US rail

Checked 2026-11-19 against Bridge's own docs (`apidocs.bridge.xyz/platform/cards/overview/stripe-issuing`, `.../noncustodial`, `.../kyc`; page note "As of April 2026"). Re-verify before building.

## What fits our design

- Cards can be funded from a Bridge-custodied wallet (`crypto_wallet[type]=bridge_wallet`) or a **non-custodial wallet** (`standard`).
- Non-custodial on **Solana**: SPL `Approve` to a delegate PDA derived from a Bridge-assigned `MERCHANT_ID`; Bridge pulls the exact amount on-chain at each authorization, no prefunding. Pass the wallet owner address, not the token account. This is the same allowance model `packages/treasury` already implements (`MockChain.approve` / `delegatedTransfer`), so the real rail slots in behind `Chain` + `billDue`.
- Card create goes through Stripe `POST /v1/issuing/cards` with `crypto_wallet` params. Freeze and spending controls are via the Stripe Issuing API. Authorizations via Stripe Issuing Authorization endpoints and webhooks, plus Bridge `card_transaction` webhooks with on-chain details.
- Chains listed: Tempo, Solana, Base, World Chain, Linea, other EVM.

## Gaps and blockers

- The documented flow is **consumer issuing** ("individual customers"). A business-customer type exists in the KYC error table, but no business card flow is documented. **Ask Bridge sales whether a platform can issue cards for each SMB customer (KYB) or must issue to an individual.**
- Card endorsement needs per-individual KYC (government ID, selfie, TIN, proof of address, sanctions/PEP). The endorsement lapses 24h after approval if no card is created.
- Access: Bridge developer account + Stripe account + signed addendum, sandbox phase, ~2 weeks with internal users, go-live 6–8 weeks after kickoff. Real-time authorization decisions are off by default.
- Not stated: whether Google Ads and Meta accept these cards for ad billing in the US. Debit/prepaid acceptance varies; test with a small charge on a test ad account once a sandbox card exists.

## Human-in-the-loop steps

1. Owner (or Storefront, depending on the answer above) completes card KYC.
2. Adding the card as the payment method in Google Ads and Meta billing is done by hand once per ad account unless an API is found.

## Alternatives

- **Rain**: card-specialist issuer with stablecoin funding, Visa principal member and reportedly Mastercard since May 2026, US + LatAm. Enterprise pricing, sales-led. Secondary sources only; verify.
- **MoonAgents Card (MoonPay)**: not available to US residents today; CLI-only management. Not viable for a US launch.
