import React, { useEffect, useState } from "react";
import { applyPwaUpdate, getPwaInstallState, subscribePwaInstall } from "./pwaInstall";

export function PwaUpdateNotice() {
  const [state, setState] = useState(getPwaInstallState);
  useEffect(() => subscribePwaInstall(setState), []);
  if (!state.updateReady) return null;
  return <div role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 z-[260] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-gray-900 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
    <div><b className="block text-sm">Hay una versión nueva de Kiosco+</b><span className="mt-1 block text-xs text-gray-600">Recargá para usarla. Tus datos guardados no se borran.</span></div>
    <button type="button" onClick={applyPwaUpdate} className="min-h-11 shrink-0 rounded-xl bg-[#1C4A44] px-4 text-sm font-bold text-white">Actualizar ahora</button>
  </div>;
}
