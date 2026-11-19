import { assertMicro, fakeAddress, hashString, type BusinessState, type ChainTx, type Micro } from "@storefront/core";

/**
 * The only surface that moves USDC. Two implementations: an in-memory mock that
 * enforces SPL-token semantics (one delegate per token account, delegated amount
 * decreases as it is used), and Solana devnet (see devnet.ts).
 *
 * `ownerRef` / `delegateRef` are opaque key references. Secret keys never enter
 * BusinessState, the LLM context or logs.
 */
export interface Chain {
  kind: "mock" | "devnet" | "localnet";
  createWallet(label: string): Promise<{ address: string; keyRef: string }>;
  balance(address: string): Promise<Micro>;
  allowance(owner: string): Promise<{ delegate: string | null; amount: Micro }>;
  /** On-ramp settlement: USDC arrives in the wallet after the processor takes payment. */
  onramp(to: string, amount: Micro, memo: string): Promise<ChainTx>;
  transfer(ownerRef: string, from: string, to: string, amount: Micro, memo: string): Promise<ChainTx>;
  approve(ownerRef: string, owner: string, delegate: string, amount: Micro): Promise<ChainTx>;
  revoke(ownerRef: string, owner: string): Promise<ChainTx>;
  delegatedTransfer(delegateRef: string, delegate: string, owner: string, to: string, amount: Micro, memo: string): Promise<ChainTx>;
}

export const PLATFORM_TREASURY = fakeAddress("storefront-platform-treasury");
export const CARD_SETTLEMENT = fakeAddress("card-rail-settlement");

export class ChainError extends Error {
  constructor(
    public code: "insufficient_funds" | "insufficient_allowance" | "not_delegate" | "bad_key",
    message: string,
  ) {
    super(message);
  }
}

export class MockChain implements Chain {
  kind = "mock" as const;
  constructor(private state: BusinessState) {}

  private acct(address: string) {
    return (this.state.chain.accounts[address] ??= { balance: 0, delegated: 0 });
  }
  private record(tx: Omit<ChainTx, "sig" | "at" | "day">): ChainTx {
    const n = this.state.chain.txs.length;
    const full: ChainTx = {
      ...tx,
      sig: `mock${hashString(`${this.state.id}:${n}:${tx.kind}:${tx.amount}`).toString(36)}${n.toString(36).padStart(4, "0")}`,
      at: new Date().toISOString(),
      day: this.state.day,
    };
    this.state.chain.txs.push(full);
    return full;
  }
  private checkKey(ref: string, address: string) {
    if (ref !== `mockkey:${address}`) throw new ChainError("bad_key", "Signer does not control this account");
  }

  async createWallet(label: string) {
    const address = fakeAddress(`${this.state.id}:${label}`);
    this.acct(address);
    return { address, keyRef: `mockkey:${address}` };
  }
  async balance(address: string) {
    return this.acct(address).balance;
  }
  async allowance(owner: string) {
    const a = this.acct(owner);
    return { delegate: a.delegate ?? null, amount: a.delegate ? a.delegated : 0 };
  }
  async onramp(to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    this.acct(to).balance += amount;
    return this.record({ kind: "mint", to, amount, memo });
  }
  async transfer(ownerRef: string, from: string, to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    this.checkKey(ownerRef, from);
    const a = this.acct(from);
    if (amount < 0 || a.balance < amount) throw new ChainError("insufficient_funds", "Wallet balance is too low");
    a.balance -= amount;
    this.acct(to).balance += amount;
    return this.record({ kind: "transfer", from, to, amount, memo });
  }
  async approve(ownerRef: string, owner: string, delegate: string, amount: Micro) {
    assertMicro(amount);
    this.checkKey(ownerRef, owner);
    const a = this.acct(owner);
    a.delegate = delegate; // SPL: a new approval replaces the previous delegate and amount
    a.delegated = amount;
    return this.record({ kind: "approve", from: owner, to: delegate, amount, memo: "Set card spending limit" });
  }
  async revoke(ownerRef: string, owner: string) {
    this.checkKey(ownerRef, owner);
    const a = this.acct(owner);
    a.delegate = undefined;
    a.delegated = 0;
    return this.record({ kind: "revoke", from: owner, amount: 0, memo: "Revoke card spending limit" });
  }
  async delegatedTransfer(delegateRef: string, delegate: string, owner: string, to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    this.checkKey(delegateRef, delegate);
    const a = this.acct(owner);
    if (a.delegate !== delegate) throw new ChainError("not_delegate", "This card is not authorised to spend from the wallet");
    if (a.delegated < amount) throw new ChainError("insufficient_allowance", "Charge is larger than the spending limit");
    if (a.balance < amount) throw new ChainError("insufficient_funds", "Wallet balance is too low");
    a.delegated -= amount;
    a.balance -= amount;
    this.acct(to).balance += amount;
    return this.record({ kind: "delegated_transfer", from: owner, to, amount, memo });
  }
}
