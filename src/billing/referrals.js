export const DEFAULT_MONTHLY_PLAN_PRICE = 30000;
export const REFERRAL_DISCOUNT_PERCENT = 20;
export const MAX_REFERRAL_DISCOUNTS = 5;
export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const normalizeReferralCode = (value) => String(value || "")
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, "");

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARGENTINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const argentinaDateKey = (value) => {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = Object.fromEntries(dateKeyFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const hasValidPayment = (account = {}) => (
  Array.isArray(account.pagos)
  && account.pagos.some((payment) => payment && !payment.revertedAt && !["revertido", "reversed", "cancelado"].includes(payment.status))
);

// Alias compatible con versiones anteriores.
export const hasPaidSubscription = hasValidPayment;

export function referralStatus(account = {}, now = Date.now()) {
  if (!account.referredByAccountId) return "sin_referido";
  if (account.referralInvalidatedAt) return "invalidado";
  if (!hasValidPayment(account)) return "pendiente";
  const expiration = argentinaDateKey(account.subscriptionExpiresAt);
  if (account.estado === "bloqueada" || !expiration || expiration < argentinaDateKey(now)) return "pausado";
  return "activo";
}

export const activeManualDiscounts = (account = {}, now = Date.now()) => {
  const today = argentinaDateKey(now);
  return (Array.isArray(account.manualDiscounts) ? account.manualDiscounts : []).filter((discount) => {
    if (!discount || discount.revokedAt || Number(discount.percent) <= 0) return false;
    const starts = argentinaDateKey(discount.startsAt || discount.createdAt);
    const expires = argentinaDateKey(discount.expiresAt);
    return (!starts || starts <= today) && (!expires || expires >= today);
  });
};

export function referralStats(accounts = [], referrerId, now = Date.now()) {
  const referred = accounts.filter((account) => (
    String(account?.referredByAccountId || "") === String(referrerId || "")
  ));
  const statuses = referred.map((account) => referralStatus(account, now));
  const activeCount = Math.min(statuses.filter((status) => status === "activo").length, MAX_REFERRAL_DISCOUNTS);
  const automaticDiscountPercent = Math.min(100, activeCount * REFERRAL_DISCOUNT_PERCENT);
  return {
    activeCount,
    pendingCount: statuses.filter((status) => status === "pendiente").length,
    pausedCount: statuses.filter((status) => status === "pausado").length,
    invalidatedCount: statuses.filter((status) => status === "invalidado").length,
    totalCount: referred.length,
    automaticDiscountPercent,
    discountPercent: automaticDiscountPercent,
  };
}

const accountBaseMonthlyPrice = (account = {}) => {
  if (account.planGratis === true) return 0;
  if (account.planPrecio === "" || account.planPrecio == null) return DEFAULT_MONTHLY_PLAN_PRICE;
  const value = Number(account.planPrecio);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MONTHLY_PLAN_PRICE;
};

export function monthlyPriceFor(account = {}, accounts = [], months = 1, now = Date.now()) {
  const baseMonthlyPrice = accountBaseMonthlyPrice(account);
  const stats = referralStats(accounts, account.id, now);
  const manualDiscounts = activeManualDiscounts(account, now);
  const manualDiscountPercent = Math.min(100, manualDiscounts.reduce((total, discount) => total + Number(discount.percent || 0), 0));
  const discountPercent = Math.min(100, stats.automaticDiscountPercent + manualDiscountPercent);
  const monthlyPrice = Math.max(0, Math.round(baseMonthlyPrice * (1 - discountPercent / 100)));
  return {
    ...stats,
    manualDiscounts,
    manualDiscountPercent,
    discountPercent,
    baseMonthlyPrice,
    monthlyPrice,
    totalPrice: monthlyPrice * Math.max(1, Number(months) || 1),
  };
}

export function withReferralStats(accounts = [], now = Date.now()) {
  return accounts.map((account) => account?.superAdmin ? account : {
    ...account,
    referralStatus: referralStatus(account, now),
    referralStats: referralStats(accounts, account.id, now),
  });
}
