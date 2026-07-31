import React from "react";
import { code39Bars, ticketBarcodeValue } from "./ticketBarcode";

export function TicketBarcode({ ticketId, color = "#111827", className = "" }) {
  const value = ticketBarcodeValue(ticketId);
  return (
    <div className={`text-center ${className}`}>
      <div className="mx-auto flex h-9 items-stretch justify-center overflow-hidden" aria-label={`Código del ticket ${value}`}>
        {code39Bars(value).map((bar, index) => (
          <i
            key={index}
            aria-hidden="true"
            style={{
              display: "block",
              width: `${bar.width}px`,
              background: bar.black ? color : "transparent",
            }}
          />
        ))}
      </div>
      <p className="mt-1 font-mono text-[9px] tracking-widest">{value}</p>
    </div>
  );
}
