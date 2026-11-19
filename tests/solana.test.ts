import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { usd } from "@storefront/core";
import { newBusiness } from "@storefront/agent";
import { ChainError, SolanaChain, solanaConfig } from "@storefront/treasury";

/** Runs against a local validator: `npm run chain:local` in another terminal, then `SOLANA_LOCALNET=1 npm test`. */
const run = process.env.SOLANA_LOCALNET === "1";

describe.skipIf(!run)("SolanaChain on a local validator (real SPL Token program)", () => {
  it("enforces delegate allowance, revoke and signer checks on-chain", async () => {
    const s = newBusiness();
    const chain = new SolanaChain(s, solanaConfig(path.join(os.tmpdir(), `sf-sol-${Date.now()}`), "localnet"));
    const w = await chain.createWallet("agent");
    const d = await chain.createWallet("card-delegate");
    await chain.onramp(w.address, usd(100), "test");
    expect(await chain.balance(w.address)).toBe(usd(100));
    await chain.approve(w.keyRef, w.address, d.address, usd(30));
    expect(await chain.allowance(w.address)).toEqual({ delegate: d.address, amount: usd(30) });
    await chain.delegatedTransfer(d.keyRef, d.address, w.address, "card-settlement", usd(20), "bill");
    expect((await chain.allowance(w.address)).amount).toBe(usd(10));
    await expect(chain.delegatedTransfer(d.keyRef, d.address, w.address, "card-settlement", usd(11), "bill")).rejects.toBeInstanceOf(ChainError);
    await chain.revoke(w.keyRef, w.address);
    expect(await chain.allowance(w.address)).toEqual({ delegate: null, amount: 0 });
    await expect(chain.transfer(d.keyRef, w.address, d.address, usd(1), "steal")).rejects.toThrow();
    expect(await chain.balance(w.address)).toBe(usd(80));
    expect(s.chain.txs.every((t) => t.explorer?.includes("explorer.solana.com"))).toBe(true);
  });
});
