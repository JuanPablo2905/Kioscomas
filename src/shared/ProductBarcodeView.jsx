import React from "react";
import { code39Bars } from "./ticketBarcode";

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function eanCheckDigit(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (![7, 11, 12].includes(digits.length)) return null;
  const weighted = [...digits].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return String((10 - (weighted % 10)) % 10);
}

export function validRetailBarcode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (![8, 12, 13].includes(digits.length)) return false;
  return eanCheckDigit(digits.slice(0, -1)) === digits.at(-1);
}

export function eanBarcodeModules(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!validRetailBarcode(digits)) return null;
  if (digits.length === 12) digits = `0${digits}`;
  if (digits.length === 8) {
    const left = [...digits.slice(0, 4)].map((digit) => EAN_L[Number(digit)]).join("");
    const right = [...digits.slice(4)].map((digit) => EAN_R[Number(digit)]).join("");
    return `101${left}01010${right}101`;
  }
  const parity = EAN13_PARITY[Number(digits[0])];
  const left = [...digits.slice(1, 7)].map((digit, index) => (parity[index] === "G" ? EAN_G : EAN_L)[Number(digit)]).join("");
  const right = [...digits.slice(7)].map((digit) => EAN_R[Number(digit)]).join("");
  return `101${left}01010${right}101`;
}

function Code39Svg({ value, color }) {
  const bars = code39Bars(value);
  let x = 10;
  const rectangles = [];
  bars.forEach((bar, index) => {
    if (bar.black) rectangles.push(<rect key={index} x={x} width={bar.width} height="30" fill={color}/>);
    x += bar.width;
  });
  return <svg viewBox={`0 0 ${x + 10} 30`} preserveAspectRatio="xMidYMid meet" className="h-8 w-32" role="img" aria-label={`Código de barras ${value}`}><rect width="100%" height="100%" fill="white"/>{rectangles}</svg>;
}

export function ProductBarcode({ code, color = "#111827", className = "" }) {
  const value = String(code || "").trim();
  const modules = eanBarcodeModules(value);
  if (!modules) return <Code39Svg value={value || "SIN-CODIGO"} color={color}/>;
  const quiet = 11;
  return <svg viewBox={`0 0 ${modules.length + quiet * 2} 34`} preserveAspectRatio="xMidYMid meet" className={`h-8 w-32 ${className}`} role="img" aria-label={`Código de barras ${value}`}>
    <rect width="100%" height="100%" fill="white"/>
    {[...modules].map((module, index) => module === "1" ? <rect key={index} x={quiet + index} width="1" height="30" fill={color}/> : null)}
  </svg>;
}
