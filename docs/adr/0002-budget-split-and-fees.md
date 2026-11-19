# ADR-0002: 80/20 budget split, flat $20 subscription

Status: accepted (2026-11-19)

- 80% of the owner's budget is ad spend (the mandate's hard cap). 20% is a reserve for agent running costs (model usage); actual usage accrues to `agent_ops` and is settled from the wallet weekly. Unused reserve stays the owner's.
- Storefront charges $20/month separately, collected upfront for the chosen term. Domain registration is a pre-approved line item at cost.
- At ~$1/day of model usage the reserve is far larger than needed for small budgets; consider capping it in a later pricing pass.
