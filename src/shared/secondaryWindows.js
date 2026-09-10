const secondaryUrl = (params = {}) => {
  const url = new URL(window.location.href);
  url.search = "";
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
};

export async function openAdminBusinessWindow({ businessId, businessName = "Negocio" }) {
  if (!businessId) throw new Error("No se pudo identificar el negocio.");
  if (window.kioscoDesktop?.secondaryWindows?.openBusiness) {
    return window.kioscoDesktop.secondaryWindows.openBusiness({ businessId: String(businessId), businessName });
  }
  const opened = window.open(
    secondaryUrl({ window: "admin-business", businessId }),
    `kiosco-admin-business-${businessId}`,
    "popup=yes,width=1280,height=820",
  );
  if (!opened) throw new Error("El navegador bloqueó la ventana. Permití ventanas emergentes para Kiosco+.");
  opened.focus();
  return { ok: true, mode: "browser" };
}

export const secondaryWindowContext = () => {
  if (typeof window === "undefined") return { mode: "main", businessId: "" };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("window") || "main";
  return {
    mode,
    businessId: mode === "admin-business" ? String(params.get("businessId") || "") : "",
    channelId: mode === "customer-display" ? String(params.get("channel") || "") : "",
  };
};
