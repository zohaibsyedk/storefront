import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { splitByWeights, usd, type BusinessState } from "@storefront/core";
import { newBusiness } from "@storefront/agent";
import { ChainError, MockChain, post, trialBalance } from "@storefront/treasury";

describe("Money", () => {
  it("splitByWeights returns integers that sum exactly to the total", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5_000_000_000 }), fc.array(fc.double({ min: 0, max: 1000, noNaN: true }), { minLength: 1, maxLength: 12 }), (total, weights) => {
        const parts = splitByWeights(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        for (const p of parts) expect(Number.isInteger(p) && p >= 0).toBe(true);
      }),
    );
  });
  it("usd() rounds to whole micro-USDC", () => {
    expect(usd(0.1) + usd(0.2)).toBe(usd(0.3));
    expect(usd(10.46)).toBe(10_460_000);
  });
});

describe("Ledger", () => {
  it("rejects unbalanced entries and stays balanced under any sequence of balanced ones", () => {
    const s = newBusiness();
    expect(() => post(s, { kind: "x", memo: "x", lines: [{ account: "a", amount: 5 }, { account: "b", amount: -4 }] })).toThrow();
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 1e9 }), { maxLength: 40 }), (amounts) => {
        const st = newBusiness();
        for (const a of amounts) post(st, { kind: "t", memo: "t", lines: [{ account: "wallet", amount: a }, { account: "owner_funds", amount: -a }] });
        expect(trialBalance(st)).toBe(0);
      }),
    );
  });
});

describe("MockChain enforces SPL delegate semantics", () => {
  const setup = async () => {
    const s: BusinessState = newBusiness();
    const chain = new MockChain(s);
    const w = await chain.createWallet("agent");
    const d = await chain.createWallet("card");
    await chain.onramp(w.address, usd(100), "test");
    return { chain, w, d };
  };
  it("a delegate can never take more than the approved amount, and the amount shrinks as it is used", async () => {
    const { chain, w, d } = await setup();
    await chain.approve(w.keyRef, w.address, d.address, usd(30));
    await chain.delegatedTransfer(d.keyRef, d.address, w.address, "sink", usd(20), "bill");
    expect((await chain.allowance(w.address)).amount).toBe(usd(10));
    await expect(chain.delegatedTransfer(d.keyRef, d.address, w.address, "sink", usd(11), "bill")).rejects.toBeInstanceOf(ChainError);
    expect(await chain.balance(w.address)).toBe(usd(80));
  });
  it("revoking removes all authority; a new approval replaces the old delegate", async () => {
    const { chain, w, d } = await setup();
    const other = await chain.createWallet("other");
    await chain.approve(w.keyRef, w.address, d.address, usd(30));
    await chain.approve(w.keyRef, w.address, other.address, usd(5));
    await expect(chain.delegatedTransfer(d.keyRef, d.address, w.address, "sink", usd(1), "bill")).rejects.toThrow();
    await chain.revoke(w.keyRef, w.address);
    await expect(chain.delegatedTransfer(other.keyRef, other.address, w.address, "sink", usd(1), "bill")).rejects.toThrow();
  });
  it("only the key holder can sign", async () => {
    const { chain, w, d } = await setup();
    await expect(chain.transfer(d.keyRef, w.address, d.address, usd(1), "steal")).rejects.toThrow();
  });
});
