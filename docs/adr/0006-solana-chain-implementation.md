# ADR-0006: Real SPL Token chain behind the same interface

Status: accepted (2026-11-19)

`SolanaChain` implements `Chain` with `@solana/web3.js` v1 and `@solana/spl-token` directly (not Solana Agent Kit), because these calls are made by deterministic Treasurer code, never by the model (ADR-0004). It uses a 6-decimal test USDC mint so one base unit equals one `Micro`. The platform key is mint authority (stand-in for the on-ramp) and pays all fees. Business wallets and the card delegate are separate keypairs stored on disk with mode 0600 and referenced by opaque `solkey:` refs.

The card delegate here stands in for Bridge's delegate PDA (docs/integrations/spend-rail-bridge-stripe.md). With a real issuer, `approve` targets the issuer's PDA and `delegatedTransfer` is performed by the issuer at authorization time; our code then only approves, revokes and reconciles.

Devnet's RPC faucet is closed, so devnet needs a manually funded fee payer; local validator mode airdrops automatically. In production, keys move to KMS/MPC custody.
