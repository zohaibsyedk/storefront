# Questions for counsel

Storefront takes card payments from small businesses, converts them to USDC held in a per-business agent wallet, and spends that USDC on the business's ads through a stablecoin-backed card. These are the questions to resolve before real money moves.

## Custody and money transmission
1. Does holding customer funds as USDC in wallets we control (even one wallet per customer, never pooled) make us a money transmitter federally (FinCEN MSB) and in which states? Would a licensed partner as custodian (e.g. Bridge-custodied wallets, Circle) remove that obligation, and what agreement structure does that need?
2. Is converting a customer's card payment into USDC on their behalf a money-transmitting or exchange activity for us, or for the on-ramp partner only?
3. Refunds of unspent balances: what timing and method obligations apply? Are unspent balances subject to unclaimed-property rules?
4. Is the 20% running-cost reserve (spent on our model costs, unused portion returned) a prepayment for services, stored value, or something else? Does it need to be segregated?

## Card program
5. Can a card issued under a consumer program (individual KYC) be used to pay for a business's advertising? Do we need a commercial card program and KYB per business?
6. Who is the cardholder of record: the business owner, the business, or Storefront? What liability follows for chargebacks and declines?

## KYC/KYB and sanctions
7. What KYB do we owe on each small business, and what sanctions/OFAC screening on payments in and card spend out?

## Advertising
8. Are we acting as an agency/reseller under Google Ads and Meta terms when we manage ad accounts owned by the business? Any certification (e.g. Google Partners) required?
9. Consumer protection: our controls block claims ("best", "guaranteed"), discounts and prices the owner has not approved. Is that sufficient, and who is liable for ad content the agent writes?
10. Special ad categories (housing, employment, credit): we drop age/gender/ZIP targeting. Anything further for fair-lending/fair-housing exposure?

## Privacy
11. Generated sites will run the Google tag and Meta Pixel + Conversions API. Consent banner requirements by state (CCPA/CPRA and others)?

## Terms
12. Terms of Service and the "mandate" the owner approves: is an in-app approval with a logged plan fingerprint, timestamp and approver sufficient authorisation for autonomous spending within the stated bounds?
