import { useEffect } from "react";

const AUTO_CLASS = "app-auto-contrast";
const DARK_TEXT = "#0f172a";
const LIGHT_TEXT = "#ffffff";

export function parseCssColor(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const rgb = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) };
  const srgb = text.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (srgb) return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255, a: srgb[4] === undefined ? 1 : Number(srgb[4]) };
  const hex = text.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i);
  if (!hex) return null;
  let normalized = hex[1];
  if (normalized.length === 3) normalized = normalized.split("").map((character) => character + character).join("");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
    a: normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) / 255 : 1,
  };
}

function composite(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (!alpha) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha,
  };
}

function luminance(color) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const channel = Math.max(0, Math.min(255, value)) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

export function bestContrastColor(background) {
  const dark = parseCssColor(DARK_TEXT);
  const light = parseCssColor(LIGHT_TEXT);
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? LIGHT_TEXT : DARK_TEXT;
}

function effectiveBackground(element) {
  const layers = [];
  for (let current = element; current instanceof Element; current = current.parentElement) {
    const background = parseCssColor(getComputedStyle(current).backgroundColor);
    if (background?.a) layers.push(background);
  }
  let result = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of layers.reverse()) result = composite(layer, result);
  return result;
}

function hasVisibleText(element) {
  if (["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(element.tagName)) return true;
  return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
}

function reconnect(observer) {
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scope", "data-menu-tone", "data-background-tone"],
  });
}

export function refreshAutoContrast() {
  const root = document.querySelector(".kiosco-themed");
  if (!root) return;
  const elements = [root, ...root.querySelectorAll("*")];
  for (const element of elements) {
    element.classList.remove(AUTO_CLASS);
    element.style.removeProperty("--app-auto-text");
  }

  const fixes = [];
  for (const element of elements) {
    if (!hasVisibleText(element) || element.closest("[data-auto-contrast='off']")) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.15) continue;
    const background = effectiveBackground(element);
    const foreground = parseCssColor(style.color);
    if (!foreground) continue;
    const renderedForeground = foreground.a < 1 ? composite(foreground, background) : foreground;
    if (contrastRatio(renderedForeground, background) < 4.5) fixes.push([element, bestContrastColor(background)]);
  }

  for (const [element, color] of fixes) {
    element.style.setProperty("--app-auto-text", color);
    element.classList.add(AUTO_CLASS);
  }
}

export function useAutoContrast() {
  useEffect(() => {
    let frame = 0;
    let observer;
    const scheduleRefresh = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        observer.disconnect();
        refreshAutoContrast();
        reconnect(observer);
      });
    };
    observer = new MutationObserver(scheduleRefresh);
    refreshAutoContrast();
    reconnect(observer);
    const refresh = () => {
      observer.disconnect();
      refreshAutoContrast();
      reconnect(observer);
    };
    window.addEventListener("kiosco-contrast-refresh", refresh);
    window.addEventListener("pointerover", scheduleRefresh, true);
    window.addEventListener("pointerout", scheduleRefresh, true);
    window.addEventListener("focusin", scheduleRefresh, true);
    window.addEventListener("focusout", scheduleRefresh, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("kiosco-contrast-refresh", refresh);
      window.removeEventListener("pointerover", scheduleRefresh, true);
      window.removeEventListener("pointerout", scheduleRefresh, true);
      window.removeEventListener("focusin", scheduleRefresh, true);
      window.removeEventListener("focusout", scheduleRefresh, true);
    };
  }, []);
}
