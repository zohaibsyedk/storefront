# ADR-0004: Deterministic core, LLM at the edges

Status: accepted (2026-11-19)

Budgets, targeting, money, the mandate, optimisation and dashboard selection are deterministic code. The model is used for copy polish, change-request interpretation and chat intent, each validated by a zod schema and lint/policy checks with a deterministic fallback. Consequences: the product runs end to end with no API key, tests are reproducible, and prompt injection can at worst change copy, never money.
