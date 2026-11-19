# What the founder needs to set up (cannot be done by the agent)

Creating a company, opening accounts and accepting terms need you: they involve your identity, signatures and legal agreements.

## Before the hackathon demo (Fri 12:00) — nothing required

The app runs fully locally on mocks. Optional: put an Anthropic API key in `apps/web/.env.local` as `ANTHROPIC_API_KEY=...` to get model-written copy; without it the app uses deterministic copy.

## To run with real money and real ads

1. **Form the company.** A Delaware C-corp (Stripe Atlas, Clerky) if you plan to raise, otherwise an LLC in your home state. Get an EIN and a business bank account (Mercury, Brex, or a local bank).
2. **Talk to a fintech lawyer before touching customer money.** Holding customers' funds in an agent wallet is custody and likely money transmission. Bring `docs/compliance.md`.
3. **Payments in:** Stripe account for the company (card payments + the $20/month subscription).
4. **Card rail:** contact Bridge (Stripe) about stablecoin-backed card issuing for business customers; Rain as the alternative. 6–8 weeks to go live.
5. **Google:** Google Cloud project, apply for Google Ads API Basic access (needs brand verification), create a manager (MCC) account. Apply for Google Business Profile API access.
6. **Meta:** Meta developer app, Business Manager, start App Review for `ads_management` and `business_management`.
7. **Domains:** Cloudflare account with a default payment profile and registrant contact.
8. **Model usage:** Anthropic API account and key.
9. **Ops:** Sentry and Langfuse (free tiers), a Supabase project and Inngest account when moving off the local store (ADR-0003).

Steps 5–6 have the longest review times; start them first.
