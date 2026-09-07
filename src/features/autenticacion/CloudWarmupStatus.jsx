import React from "react";
import { CheckCircle2, Cloud, Loader2, RefreshCw, WifiOff } from "lucide-react";

export function CloudWarmupStatus({ state, onRetry, className = "" }) {
  const status = state?.status || "idle";
  if (status === "idle") return null;

  const presentation = status === "ready"
    ? {
      icon: <CheckCircle2 size={18}/>,
      title: "Nube lista",
      detail: "La conexión está preparada.",
      colors: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
    : status === "offline"
      ? {
        icon: <WifiOff size={18}/>,
        title: "Sin conexión a Internet",
        detail: "Podés completar los datos y reintentar cuando vuelva la conexión.",
        colors: "border-amber-200 bg-amber-50 text-amber-900",
      }
      : status === "error"
        ? {
          icon: <Cloud size={18}/>,
          title: "La nube todavía no respondió",
          detail: state?.error || "Esperá unos segundos y volvé a intentar.",
          colors: "border-red-200 bg-red-50 text-red-800",
        }
        : {
          icon: <Loader2 size={18} className="animate-spin"/>,
          title: "Preparando la nube…",
          detail: "Render se está iniciando. La primera conexión puede tardar cerca de un minuto; Kiosco+ continuará automáticamente.",
          colors: "border-amber-200 bg-amber-50 text-amber-900",
        };

  return <div role="status" className={`${presentation.colors} ${className} rounded-xl border px-3 py-3 text-xs leading-5`}>
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{presentation.icon}</span>
      <div className="min-w-0 flex-1">
        <b className="block text-sm">{presentation.title}</b>
        <span className="block opacity-80">{presentation.detail}</span>
      </div>
      {["error", "offline"].includes(status) && onRetry && <button type="button" onClick={onRetry} className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-current/20 bg-white/70 px-2 font-semibold hover:bg-white"><RefreshCw size={14}/>Reintentar</button>}
    </div>
  </div>;
}

