"use client";
import { useParams } from "next/navigation";
import { fmtUsd } from "@storefront/core";
import { useBusiness } from "@/lib/api";
import { ErrorNote, Loading, Receipt, Row } from "@/components/ui";

const KIND: Record<string, string> = { mint: "Money in", transfer: "Payment out", approve: "Card limit set", revoke: "Card limit removed", delegated_transfer: "Card payment" };

export default function Wallet() {
  const { id } = useParams<{ id: string }>();
  const { view, error, act, busy } = useBusiness(id);
  if (!view) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />;
  const { state, money } = view;
  if (!state.wallet) return <p className="py-10">The wallet is created when you approve your plan.</p>;
  const rec = state.reconciliations.at(-1);
  const stopped = state.status === "stopped" || state.status === "completed";
  const adLeft = Math.max(0, money.adBudget - money.settled);
  return (
    <div className="py-8">
      <h1>Wallet</h1>
      <p className="mt-3 max-w-2xl text-lg">Your money is held as USDC in a wallet that belongs to your agent. The ad platforms are paid by a card that can only pull up to a set limit from it.</p>
      <p className="hint mt-1 break-all num">
        {state.wallet.chain === "mock" ? "Test chain" : "Solana devnet"} address {state.wallet.address}
      </p>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <Receipt title="Where the money stands">
          <Row label="Paid in" value={fmtUsd(money.deposited)} />
          <Row label="Ad bills paid by card" value={`- ${fmtUsd(money.settled)}`} />
          <Row label="Storefront subscription" value={`- ${fmtUsd(money.subscriptionPaid)}`} />
          {money.feesPaid > 0 && <Row label="Domain name" value={`- ${fmtUsd(money.feesPaid)}`} />}
          <Row label="Agent running costs" value={`- ${fmtUsd(money.opsUsed)}`} note={`From the ${fmtUsd(money.opsReserve, { cents: false })} reserve`} />
          {money.refunded > 0 && <Row label="Returned to you" value={`- ${fmtUsd(money.refunded)}`} />}
          <Row label="In the wallet now" value={fmtUsd(money.wallet)} total />
          {stopped && money.wallet > 0 && (
            <button className="btn mt-4 w-full" disabled={busy === "withdraw"} onClick={() => act("withdraw")}>
              Send {fmtUsd(money.wallet)} back to me
            </button>
          )}
        </Receipt>
        <div>
          <h2>The card&apos;s limit</h2>
          <p className="display mt-2 text-4xl num">{fmtUsd(money.allowance)}</p>
          <p>is the most the card can take from the wallet right now{state.card.frozen ? ". The card is frozen." : "."}</p>
          <p className="hint mt-2">
            The limit is set on-chain and covers what is already owed ({fmtUsd(money.unbilled)}) plus the rest of this month&apos;s ad budget. {fmtUsd(adLeft)} of ad budget is not yet paid out; the rest of the wallet is out of the card&apos;s reach even if our own records were wrong.
          </p>
          {rec && (
            <div className="mt-6">
              <h3>
                Daily money check <span className={`tag ${rec.ok ? "tag-leaf" : "tag-brick"}`}>{rec.ok ? "Passed" : "Mismatch"}</span>
              </h3>
              <ul className="mt-2 text-sm">
                {rec.checks.map((c) => (
                  <li key={c.label} className="flex items-baseline gap-2 border-t border-line py-1.5">
                    <span className={c.ok ? "text-leaf" : "text-brick"}>{c.ok ? "✓" : "✗"}</span>
                    <span className="flex-1">
                      {c.label} <span className="hint">({c.detail})</span>
                    </span>
                    <span className="num">
                      {fmtUsd(c.a)} = {fmtUsd(c.b)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="hint mt-1">
                {state.reconciliations.filter((r) => r.ok).length} of {state.reconciliations.length} daily checks have passed.
              </p>
            </div>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2>Card payments to ad platforms</h2>
        {state.card.txns.length === 0 ? (
          <p className="mt-2 text-muted">None yet. Ad platforms bill after the ads run, once the amount owed passes a threshold.</p>
        ) : (
          <ul className="mt-3 divide-y-[1.5px] divide-line rounded-[14px] bg-white">
            {state.card.txns.slice().reverse().map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
                <span className="hint w-16 num">Day {t.day + 1}</span>
                <span className="font-bold">{t.platform === "google" ? "Google Ads" : "Meta"}</span>
                <span className="hint flex-1">{t.reason}</span>
                {t.status === "declined" && <span className="tag tag-brick">Declined</span>}
                <span className="num font-bold">{fmtUsd(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2>On-chain record</h2>
        <div className="mt-3 overflow-x-auto rounded-[14px] bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <tbody>
              {state.chain.txs.slice().reverse().slice(0, 60).map((t) => (
                <tr key={t.sig} className="border-b border-line">
                  <td className="px-4 py-2 hint num">Day {t.day + 1}</td>
                  <td className="py-2 font-bold">{KIND[t.kind]}</td>
                  <td className="py-2">{t.memo}</td>
                  <td className="py-2 text-right num">{t.kind === "revoke" ? "" : fmtUsd(t.amount)}</td>
                  <td className="px-4 py-2 text-right hint num">{t.explorer ? <a className="link" href={t.explorer} target="_blank" rel="noreferrer">{t.sig.slice(0, 8)}</a> : t.sig.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
