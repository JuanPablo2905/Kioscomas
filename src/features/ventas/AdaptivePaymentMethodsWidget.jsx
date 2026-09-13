import React from "react";
import { Banknote, CreditCard, HandCoins, Landmark, NotebookTabs } from "lucide-react";
import { useWidgetSize } from "./useWidgetSize";

const methods = {
  "Efectivo": { Icon: Banknote, className: "cash" },
  "Mercado Pago": { Icon: HandCoins, className: "mercado-pago" },
  "Transferencia": { Icon: Landmark, className: "transfer" },
  "Tarjeta": { Icon: CreditCard, className: "card" },
  "Cuenta corriente": { Icon: NotebookTabs, className: "account" },
};

export function AdaptivePaymentMethodsWidget({ widget = {}, preview = false }) {
  const [ref, size] = useWidgetSize();
  const items = Array.isArray(widget.items) && widget.items.length ? widget.items : ["Efectivo", "Mercado Pago", "Tarjeta"];
  const ratio = size.width / Math.max(1, size.height);
  const orientation = ratio > 1.45 ? "horizontal" : ratio < .72 ? "vertical" : "grid";
  const compact = size.width > 0 && (size.width < 150 || size.height < 105);
  return <section ref={ref} className={`adaptive-payment-methods is-${orientation} ${compact ? "is-compact" : ""} ${preview ? "is-preview" : ""}`}>
    <header><span>Medios de pago</span><strong>Pagá como prefieras</strong></header>
    <div className="adaptive-payment-methods__items">
      {items.map((name) => {
        const definition = methods[name] || methods.Tarjeta;
        const Icon = definition.Icon;
        return <div key={name} className={`adaptive-payment-method ${definition.className}`}><span><Icon aria-hidden="true"/></span><b>{name}</b></div>;
      })}
    </div>
  </section>;
}
