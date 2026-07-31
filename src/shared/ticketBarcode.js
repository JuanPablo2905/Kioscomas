const CODE39 = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww",
  O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn",
  S: "nnwnnnwwn", T: "nnnnwnwwn", U: "wwnnnnnnw", V: "nwwnnnnnw",
  W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "$": "nwnwnwnnn",
  "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
};

export function ticketBarcodeValue(ticketId) {
  return `KAT-${String(ticketId ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "-")}`;
}

export function parseTicketBarcode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized.startsWith("KAT-") ? normalized.slice(4) : null;
}

export function code39Bars(value) {
  const safe = String(value || "").toUpperCase().replace(/[^0-9A-Z .$/+%-]/g, "-");
  const encoded = `*${safe}*`;
  const bars = [];
  let black = true;
  for (let charIndex = 0; charIndex < encoded.length; charIndex += 1) {
    const pattern = CODE39[encoded[charIndex]] || CODE39["-"];
    for (const width of pattern) {
      bars.push({ black, width: width === "w" ? 3 : 1 });
      black = !black;
    }
    if (charIndex < encoded.length - 1) {
      bars.push({ black: false, width: 1 });
      black = true;
    }
  }
  return bars;
}

export function ticketBarcodeHtml(ticketId, color = "#111") {
  const value = ticketBarcodeValue(ticketId);
  const bars = code39Bars(value)
    .map((bar) => `<i style="display:block;height:34px;width:${bar.width}px;background:${bar.black ? color : "transparent"}"></i>`)
    .join("");
  return `<div style="display:flex;justify-content:center;margin:10px auto 2px;line-height:0">${bars}</div><p style="text-align:center;font-size:9px;letter-spacing:1px;margin:0">${value}</p>`;
}
