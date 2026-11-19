# Ads, listings and domains — status from the brief (not re-verified tonight)

These facts come from the founder brief (verified Nov 2026 by the founder). They were **not** re-checked in this session; re-verify before integrating.

| Provider | Access needed | What is manual | Status in this build |
|---|---|---|---|
| Google Ads API | Google Cloud project with Basic access (brand verification), manager account (MCC) | Payment method on each client account's billing, likely once by hand | Mocked by `packages/market` |
| Meta Marketing API | App Review for `ads_management`, `business_management`; Business Manager; partner access to client ad account and Page; System User tokens | Owner grants partner access; card added to billing | Mocked |
| Google Business Profile | API access application; always `googleLocations.search` before create | Verification by owner (phone, video, postcard) | Drafted + owner task |
| Apple Business | Partners only | Owner submits from own Apple Account | Package + checklist |
| Cloudflare Registrar API (beta) | Account default payment profile + registrant contact; 100-domain cap | — | `MockRegistrar` behind `Registrar` |

All of these require a legal entity and accounts in its name (see `docs/runbooks/owner-setup.md`).
