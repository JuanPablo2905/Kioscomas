export const DEFAULT_MONTHLY_PLAN_PRICE = 30000;
export const REFERRAL_DISCOUNT_PERCENT = 20;
export const MAX_REFERRAL_DISCOUNTS = 5;

export const normalizeReferralCode = (value) => String(value || "")
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, "");

export const hasPaidSubscription = (account = {}) => (
  Array.isArray(account.pagos) && account.pagos.length > 0
);

export function referralStats(accounts = [], referrerId) {
  const referred = accounts.filter((account) => (
    String(account?.referredByAccountId || "") === String(referrerId || "")
  ));
  const active = referred.filter(hasPaidSubscription);
  const activeCount = Math.min(active.length, MAX_REFERRAL_DISCOUNTS);
  return {
    activeCount,
    pendingCount: Math.max(0, referred.length - active.length),
    totalCount: referred.length,
    discountPercent: Math.min(100, activeCount * REFERRAL_DISCOUNT_PERCENT),
  };
}

export function monthlyPriceFor(account = {}, accounts = [], months = 1) {
  const baseMonthlyPrice = Math.max(0, Number(account.planPrecio ?? DEFAULT_MONTHLY_PLAN_PRICE) || 0);
  const stats = referralStats(accounts, account.id);
  const monthlyPrice = Math.max(0, Math.round(baseMonthlyPrice * (1 - stats.discountPercent / 100)));
  return {
    ...stats,
    baseMonthlyPrice,
    monthlyPrice,
    totalPrice: monthlyPrice * Math.max(1, Number(months) || 1),
  };
}

export function withReferralStats(accounts = []) {
  return accounts.map((account) => account?.superAdmin ? account : {
    ...account,
    referralStats: referralStats(accounts, account.id),
  });
}
