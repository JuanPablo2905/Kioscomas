const channels = new Map();

const publicState = (state) => {
  if (!state || state.displayConfig?.operationMode !== "ads-only") return state;
  const { items, payment, subtotal, total, discount, discountLines, manualDiscount, promotionDiscount, ...advertising } = state;
  return { ...advertising, mode: "idle", items: [], payment: null, subtotal: 0, total: 0, discount: 0, discountLines: [] };
};

const safeChannelId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);

const channelRecord = (channelId) => {
  const id = safeChannelId(channelId);
  if (!id || typeof BroadcastChannel === "undefined") return null;
  if (channels.has(id)) return channels.get(id);
  const channel = new BroadcastChannel(`kiosco-customer-display:${id}`);
  const record = { id, channel, state: null, listeners: new Set() };
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "ready" && record.state) channel.postMessage({ type: "state", state: record.state });
    if (event.data?.type === "state") record.listeners.forEach((listener) => listener(event.data.state));
  });
  channels.set(id, record);
  return record;
};

const channelForBusiness = (businessId) => {
  const key = `kiosco:customer-display-channel:${String(businessId || "default")}`;
  let id = "";
  try { id = sessionStorage.getItem(key) || ""; } catch {}
  if (!id) {
    id = safeChannelId(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try { sessionStorage.setItem(key, id); } catch {}
  }
  return id;
};

export async function listCustomerDisplays() {
  if (window.kioscoDesktop?.customerDisplay?.listDisplays) return window.kioscoDesktop.customerDisplay.listDisplays();
  return { mode: "browser", displays: [] };
}

export async function openCustomerDisplay({ businessId, displayId = "", fullscreen = true, state = null }) {
  const channelId = channelForBusiness(businessId);
  const record = channelRecord(channelId);
  const visibleState = publicState(state);
  if (visibleState) record && (record.state = visibleState);
  if (window.kioscoDesktop?.customerDisplay?.open) {
    const result = await window.kioscoDesktop.customerDisplay.open({ channelId, displayId, fullscreen, state: visibleState });
    if (visibleState) publishCustomerDisplay({ businessId, state: visibleState });
    return { ...result, channelId };
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("window", "customer-display");
  url.searchParams.set("channel", channelId);
  const opened = window.open(url.toString(), "kiosco-customer-display", "popup=yes,width=1000,height=720");
  if (!opened) throw new Error("El navegador bloqueó la pantalla. Permití ventanas emergentes para Kiosco+.");
  opened.focus();
  window.setTimeout(() => visibleState && publishCustomerDisplay({ businessId, state: visibleState }), 350);
  return { ok: true, mode: "browser", channelId };
}

export function publishCustomerDisplay({ businessId, state }) {
  const channelId = channelForBusiness(businessId);
  const record = channelRecord(channelId);
  const visibleState = publicState(state);
  if (record) {
    record.state = visibleState;
    record.channel.postMessage({ type: "state", state: visibleState });
  }
  window.kioscoDesktop?.customerDisplay?.publish?.({ channelId, state: visibleState }).catch?.(() => {});
}

export async function closeCustomerDisplay({ businessId }) {
  const channelId = channelForBusiness(businessId);
  const record = channelRecord(channelId);
  record?.channel.postMessage({ type: "closed" });
  if (window.kioscoDesktop?.customerDisplay?.close) await window.kioscoDesktop.customerDisplay.close();
}

export function subscribeCustomerDisplay(channelId, listener) {
  const record = channelRecord(channelId);
  if (record) {
    record.listeners.add(listener);
    record.channel.postMessage({ type: "ready" });
  }
  const unsubscribeDesktop = window.kioscoDesktop?.customerDisplay?.onState?.(listener);
  window.kioscoDesktop?.customerDisplay?.ready?.().catch?.(() => {});
  return () => {
    record?.listeners.delete(listener);
    if (typeof unsubscribeDesktop === "function") unsubscribeDesktop();
  };
}

export const customerDisplayChannelForBusiness = channelForBusiness;
