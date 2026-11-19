import { PLATFORMS, completeness, type BusinessState, type Micro, type Platform } from "@storefront/core";
import { chainFor } from "@storefront/agent";
import { ACCOUNTS, balance, settledTotal, spendTotal, unbilledTotal } from "@storefront/treasury";

export interface MoneyView {
  wallet: Micro;
  allowance: Micro;
  adBudget: Micro;
  adSpent: Micro;
  adSpentBy: Record<Platform, Micro>;
  opsReserve: Micro;
  opsUsed: Micro;
  subscriptionPaid: Micro;
  feesPaid: Micro;
  deposited: Micro;
  unbilled: Micro;
  settled: Micro;
  refunded: Micro;
}

export interface BusinessView {
  state: BusinessState;
  money: MoneyView;
  completeness: ReturnType<typeof completeness>;
  llm: string;
}

/** What the browser gets: the business document minus key references, plus derived money figures. */
export async function viewOf(state: BusinessState): Promise<BusinessView> {
  const chain = chainFor(state);
  const plan = state.plans[state.plans.length - 1];
  const allowance = state.wallet ? (await chain.allowance(state.wallet.address)).amount : 0;
  const wallet = state.wallet ? await chain.balance(state.wallet.address) : 0;
  const money: MoneyView = {
    wallet,
    allowance,
    adBudget: state.mandate?.totalAdBudget ?? plan?.budget.adSpend ?? 0,
    adSpent: spendTotal(state),
    adSpentBy: Object.fromEntries(PLATFORMS.map((p) => [p, spendTotal(state, p)])) as Record<Platform, Micro>,
    opsReserve: state.mandate?.opsReserve ?? plan?.budget.opsReserve ?? 0,
    opsUsed: balance(state, ACCOUNTS.agentOps),
    subscriptionPaid: balance(state, ACCOUNTS.subscription),
    feesPaid: balance(state, ACCOUNTS.domainFee),
    deposited: -balance(state, ACCOUNTS.ownerFunds) || 0,
    unbilled: unbilledTotal(state),
    settled: settledTotal(state),
    refunded: balance(state, ACCOUNTS.refunds),
  };
  const safe: BusinessState = { ...state, wallet: state.wallet ? { ...state.wallet, keyRef: "", delegateRef: "" } : undefined };
  return { state: safe, money, completeness: completeness(state.draft), llm: state.llm.provider };
}
