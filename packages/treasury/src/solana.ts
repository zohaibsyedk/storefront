import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, type Commitment } from "@solana/web3.js";
import { approveChecked, createMint, getAccount, getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync, mintTo, revoke, transferChecked, TokenAccountNotFoundError } from "@solana/spl-token";
import { assertMicro, type BusinessState, type ChainTx, type Micro } from "@storefront/core";
import { ChainError, type Chain } from "./chain";

/**
 * Real SPL-token implementation of `Chain` for Solana devnet or a local validator.
 *
 * - A test USDC mint with 6 decimals, so 1 base unit = 1 micro-USDC. The platform key is the
 *   mint authority (the "on-ramp" mints test USDC after a card payment).
 * - The platform key pays every transaction fee, so business wallets never need SOL.
 * - Secret keys live in `<dataDir>/keys`, referenced by opaque `solkey:<address>` refs; they never
 *   enter BusinessState, the browser or the model.
 * - Named sinks (platform treasury, card settlement, payouts) that are not real public keys are
 *   mapped to deterministic keypairs so every transfer lands in a real token account.
 */
export type SolanaCluster = "devnet" | "localnet";
const DECIMALS = 6;
const COMMITMENT: Commitment = "confirmed";

export interface SolanaConfig {
  cluster: SolanaCluster;
  rpcUrl: string;
  keysDir: string;
}

export function solanaConfig(dataDir: string, cluster?: SolanaCluster): SolanaConfig {
  const c = cluster ?? (process.env.STOREFRONT_CHAIN === "localnet" ? "localnet" : "devnet");
  return {
    cluster: c,
    rpcUrl: process.env.STOREFRONT_SOLANA_RPC ?? (c === "localnet" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com"),
    keysDir: path.join(dataDir, "keys", c),
  };
}

function loadOrCreateKey(file: string): Keypair {
  if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
  const k = Keypair.generate();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 });
  return k;
}

export class SolanaChain implements Chain {
  readonly kind: SolanaCluster;
  private conn: Connection;
  private platform: Keypair;
  private mintPk?: PublicKey;

  constructor(
    private state: BusinessState,
    private cfg: SolanaConfig,
  ) {
    this.kind = cfg.cluster;
    this.conn = new Connection(cfg.rpcUrl, COMMITMENT);
    this.platform = loadOrCreateKey(path.join(cfg.keysDir, "platform.json"));
  }

  /** Fee payer address: on devnet, fund it once at https://faucet.solana.com. */
  get feePayer(): string {
    return this.platform.publicKey.toBase58();
  }

  async ensureReady(): Promise<void> {
    const bal = await this.conn.getBalance(this.platform.publicKey);
    if (bal < 0.05 * LAMPORTS_PER_SOL) {
      if (this.cfg.cluster === "localnet") {
        const sig = await this.conn.requestAirdrop(this.platform.publicKey, 10 * LAMPORTS_PER_SOL);
        await this.conn.confirmTransaction(sig, COMMITMENT);
      } else throw new Error(`The Solana fee payer ${this.feePayer} has no devnet SOL. Fund it at https://faucet.solana.com and try again.`);
    }
    await this.mint();
  }

  private async mint(): Promise<PublicKey> {
    if (this.mintPk) return this.mintPk;
    const f = path.join(this.cfg.keysDir, "mint.json");
    if (fs.existsSync(f)) {
      const pk = new PublicKey(JSON.parse(fs.readFileSync(f, "utf8")).mint);
      if (await this.conn.getAccountInfo(pk)) return (this.mintPk = pk);
    }
    const pk = await createMint(this.conn, this.platform, this.platform.publicKey, null, DECIMALS, undefined, { commitment: COMMITMENT });
    fs.mkdirSync(this.cfg.keysDir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ mint: pk.toBase58(), note: "Storefront test USDC (6 decimals)" }));
    return (this.mintPk = pk);
  }

  private keyFile(address: string) {
    return path.join(this.cfg.keysDir, "wallets", `${address}.json`);
  }
  private signer(ref: string, address: string): Keypair {
    if (ref !== `solkey:${address}`) throw new ChainError("bad_key", "Signer does not control this account");
    const f = this.keyFile(address);
    if (!fs.existsSync(f)) throw new ChainError("bad_key", "Unknown key");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(f, "utf8"))));
  }
  /** Real public key for an address, or a deterministic stand-in for a named sink. */
  private owner(address: string): PublicKey {
    try {
      const pk = new PublicKey(address);
      if (PublicKey.isOnCurve(pk.toBytes())) return pk;
    } catch {
      /* not a public key */
    }
    return Keypair.fromSeed(createHash("sha256").update(`storefront-sink:${address}`).digest()).publicKey;
  }
  private async ata(owner: PublicKey, create: boolean): Promise<PublicKey> {
    const mint = await this.mint();
    if (!create) return getAssociatedTokenAddressSync(mint, owner);
    const acct = await getOrCreateAssociatedTokenAccount(this.conn, this.platform, mint, owner, false, COMMITMENT);
    return acct.address;
  }
  private explorer(sig: string): string {
    return this.cfg.cluster === "devnet" ? `https://explorer.solana.com/tx/${sig}?cluster=devnet` : `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(this.cfg.rpcUrl)}`;
  }
  private record(tx: Omit<ChainTx, "at" | "day" | "explorer">): ChainTx {
    const full: ChainTx = { ...tx, at: new Date().toISOString(), day: this.state.day, explorer: this.explorer(tx.sig) };
    this.state.chain.txs.push(full);
    return full;
  }
  private async tokenAccount(owner: PublicKey) {
    try {
      return await getAccount(this.conn, await this.ata(owner, false), COMMITMENT);
    } catch (e) {
      if (e instanceof TokenAccountNotFoundError) return null;
      throw e;
    }
  }

  async createWallet(label: string) {
    await this.ensureReady();
    const k = Keypair.generate();
    const address = k.publicKey.toBase58();
    fs.mkdirSync(path.dirname(this.keyFile(address)), { recursive: true });
    fs.writeFileSync(this.keyFile(address), JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 });
    if (label !== "card-delegate") await this.ata(k.publicKey, true);
    return { address, keyRef: `solkey:${address}` };
  }

  async balance(address: string): Promise<Micro> {
    const acct = await this.tokenAccount(this.owner(address));
    return acct ? Number(acct.amount) : 0;
  }

  async allowance(owner: string) {
    const acct = await this.tokenAccount(this.owner(owner));
    if (!acct || !acct.delegate) return { delegate: null, amount: 0 };
    return { delegate: acct.delegate.toBase58(), amount: Number(acct.delegatedAmount) };
  }

  async onramp(to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    await this.ensureReady();
    const dest = await this.ata(this.owner(to), true);
    const sig = await mintTo(this.conn, this.platform, await this.mint(), dest, this.platform, BigInt(amount), [], { commitment: COMMITMENT });
    return this.record({ sig, kind: "mint", to, amount, memo });
  }

  async transfer(ownerRef: string, from: string, to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    const signer = this.signer(ownerRef, from);
    if ((await this.balance(from)) < amount) throw new ChainError("insufficient_funds", "Wallet balance is too low");
    const src = await this.ata(signer.publicKey, false);
    const dest = await this.ata(this.owner(to), true);
    const sig = await transferChecked(this.conn, this.platform, src, await this.mint(), dest, signer, BigInt(amount), DECIMALS, [], { commitment: COMMITMENT });
    return this.record({ sig, kind: "transfer", from, to, amount, memo });
  }

  async approve(ownerRef: string, owner: string, delegate: string, amount: Micro) {
    assertMicro(amount);
    const signer = this.signer(ownerRef, owner);
    const src = await this.ata(signer.publicKey, false);
    const sig = await approveChecked(this.conn, this.platform, await this.mint(), src, new PublicKey(delegate), signer, BigInt(amount), DECIMALS, [], { commitment: COMMITMENT });
    return this.record({ sig, kind: "approve", from: owner, to: delegate, amount, memo: "Set card spending limit" });
  }

  async revoke(ownerRef: string, owner: string) {
    const signer = this.signer(ownerRef, owner);
    const src = await this.ata(signer.publicKey, false);
    const sig = await revoke(this.conn, this.platform, src, signer, [], { commitment: COMMITMENT });
    return this.record({ sig, kind: "revoke", from: owner, amount: 0, memo: "Revoke card spending limit" });
  }

  async delegatedTransfer(delegateRef: string, delegate: string, owner: string, to: string, amount: Micro, memo: string) {
    assertMicro(amount);
    const signer = this.signer(delegateRef, delegate);
    const acct = await this.tokenAccount(this.owner(owner));
    if (!acct) throw new ChainError("insufficient_funds", "Wallet has no USDC account");
    if (!acct.delegate || acct.delegate.toBase58() !== delegate) throw new ChainError("not_delegate", "This card is not authorised to spend from the wallet");
    if (Number(acct.delegatedAmount) < amount) throw new ChainError("insufficient_allowance", "Charge is larger than the spending limit");
    if (Number(acct.amount) < amount) throw new ChainError("insufficient_funds", "Wallet balance is too low");
    const dest = await this.ata(this.owner(to), true);
    const sig = await transferChecked(this.conn, this.platform, acct.address, await this.mint(), dest, signer, BigInt(amount), DECIMALS, [], { commitment: COMMITMENT });
    return this.record({ sig, kind: "delegated_transfer", from: owner, to, amount, memo });
  }
}
