# ADR-0005: Optimizer acts at ad-set and platform level, gently

Status: accepted (2026-11-19)

Platforms do their own delivery optimisation inside an ad set, so per-ad budget control is not available. The optimizer:
- pauses an ad only when P(best) < 4% after 400+ impressions and $12+ spend, at most one per ad set per 14 days, and replaces it with a variant that keeps the winner's attributes and changes one;
- moves ad-set budgets every 3 days by at most 18% (below the ~20% "significant edit" that resets learning) within the owner's daily bound;
- moves budget between platforms weekly within the owner's weekly bound and max-share cap, comparing cost per result on the same 7-day-click attribution;
- pauses a platform on statistically strong anomalies (tracking broken, CPA spike) and waits for the owner to resume.

Simulated over 8 seeds × 90 days at $4,500, the full optimizer beat a static even split by ~8% more results; at $1,500 by ~7%. Regret is reported in `tests/optimizer.test.ts`. Aggressive daily moves performed worse than static in an earlier version because they kept resetting learning.
