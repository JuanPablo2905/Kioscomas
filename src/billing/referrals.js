export const DEFAULT_MONTHLY_PLAN_PRICE = 50000;
export const INTRODUCTORY_MONTHLY_PLAN_PRICE = 30000;
export const INTRODUCTORY_PAID_MONTHS = 3;
export const BETA_TRIAL_DAYS = 30;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
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

export const validPayments = (account = {}) => (Array.isArray(account.pagos) ? account.pagos : [])
  .filter((payment) => payment && !payment.revertedAt && !["revertido", "reversed", "cancelado"].includes(payment.status));

export const paidBillingCycles = (account = {}) => validPayments(account)
  .reduce((total, payment) => total + Math.max(1, Number(payment.meses) || 1), 0);

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

const accountBaseMonthlyPrice = (account = {}, completedPaidCycles = paidBillingCycles(account)) => {
  if (account.planGratis === true) return 0;
  const standardPrice = completedPaidCycles < INTRODUCTORY_PAID_MONTHS
    ? INTRODUCTORY_MONTHLY_PLAN_PRICE
    : DEFAULT_MONTHLY_PLAN_PRICE;
  if (account.planPrecio === "" || account.planPrecio == null) return standardPrice;
  const value = Number(account.planPrecio);
  return Number.isFinite(value) && value > 0 ? value : standardPrice;
};

export function monthlyPriceFor(account = {}, accounts = [], months = 1, now = Date.now()) {
  const stats = referralStats(accounts, account.id, now);
  const completedPaidCycles = paidBillingCycles(account);
  const introductory = account.planGratis !== true
    && !(Number(account.planPrecio) > 0)
    && completedPaidCycles < INTRODUCTORY_PAID_MONTHS;
  const manualDiscounts = activeManualDiscounts(account, now);
  const manualDiscountPercent = Math.min(100, manualDiscounts.reduce((total, discount) => total + Number(discount.percent || 0), 0));
  // La promoción de lanzamiento ya es un descuento fuerte. Los referidos se
  // acumulan desde el cuarto ciclo pago; los descuentos manuales siguen
  // disponibles para resolver casos comerciales puntuales.
  const appliedReferralDiscountPercent = introductory ? 0 : stats.automaticDiscountPercent;
  const discountPercent = Math.min(100, appliedReferralDiscountPercent + manualDiscountPercent);
  const baseMonthlyPrice = accountBaseMonthlyPrice(account, completedPaidCycles);
  const monthlyPrice = Math.max(0, Math.round(baseMonthlyPrice * (1 - discountPercent / 100)));
  const billingBreakdown = Array.from({ length: Math.max(1, Number(months) || 1) }, (_, offset) => {
    const cycle = completedPaidCycles + offset;
    const cycleIsIntroductory = account.planGratis !== true && !(Number(account.planPrecio) > 0) && cycle < INTRODUCTORY_PAID_MONTHS;
    const cycleBasePrice = accountBaseMonthlyPrice(account, cycle);
    const cycleReferralDiscount = cycleIsIntroductory ? 0 : stats.automaticDiscountPercent;
    const cycleDiscountPercent = Math.min(100, cycleReferralDiscount + manualDiscountPercent);
    return {
      cycle: cycle + 1,
      introductory: cycleIsIntroductory,
      basePrice: cycleBasePrice,
      referralDiscountPercent: cycleReferralDiscount,
      manualDiscountPercent,
      discountPercent: cycleDiscountPercent,
      price: Math.max(0, Math.round(cycleBasePrice * (1 - cycleDiscountPercent / 100))),
    };
  });
  return {
    ...stats,
    completedPaidCycles,
    introductory,
    introductoryPaidMonthsRemaining: introductory ? Math.max(0, INTRODUCTORY_PAID_MONTHS - completedPaidCycles) : 0,
    appliedReferralDiscountPercent,
    manualDiscounts,
    manualDiscountPercent,
    discountPercent,
    baseMonthlyPrice,
    monthlyPrice,
    billingBreakdown,
    totalPrice: billingBreakdown.reduce((total, cycle) => total + cycle.price, 0),
  };
}

export function withReferralStats(accounts = [], now = Date.now()) {
  return accounts.map((account) => account?.superAdmin ? account : {
    ...account,
    referralStatus: referralStatus(account, now),
    referralStats: referralStats(accounts, account.id, now),
  });
}
