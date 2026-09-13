import { useEffect } from "react";

const ACTIONS = [
  { pattern: /guardar/i, message: "Guardado", inline: true }, { pattern: /aprobar|confirmar/i, message: "Aprobado" },
  { pattern: /cobrar|registrar pago/i, message: "Operación registrada", requiresModal: true }, { pattern: /registrar|crear|agregar/i, message: "Registrado", requiresModal: true },
  { pattern: /resolver|terminar/i, message: "Completado" }, { pattern: /eliminar|borrar/i, message: "Eliminado", danger: true },
];

let feedbackAudioContext = null;

function playActionSound(action, volume) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    feedbackAudioContext ||= new AudioContext();
    const oscillator = feedbackAudioContext.createOscillator();
    const gain = feedbackAudioContext.createGain();
    const level = Math.max(0, Math.min(100, Number(volume ?? 70))) / 100;
    oscillator.type = "sine";
    oscillator.frequency.value = action.danger ? 260 : 720;
    gain.gain.setValueAtTime(Math.max(0.001, level * 0.045), feedbackAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, feedbackAudioContext.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(feedbackAudioContext.destination);
    oscillator.start();
    oscillator.stop(feedbackAudioContext.currentTime + 0.12);
  } catch {}
}

export function useInteractionFeedback(enabled = true, durationSeconds = 2, soundOptions = {}) {
  useEffect(() => {
    if (!enabled && !soundOptions.enabled) return;
    const durationMs = Math.max(800, Math.min(10000, Number(durationSeconds || 2) * 1000));
    const values = new WeakMap();
    const animateNumber = (input, direction) => { input.classList.remove("number-bump-up", "number-bump-down"); void input.offsetWidth; input.classList.add(direction > 0 ? "number-bump-up" : "number-bump-down"); setTimeout(() => input.classList.remove("number-bump-up", "number-bump-down"), 340); };
    const click = (event) => {
      const button = event.target.closest("button"); if (!button || button.disabled) return;
      const numericDirection = button.querySelector(".lucide-plus") ? 1 : button.querySelector(".lucide-minus") ? -1 : 0;
      if (enabled && numericDirection) { const container = button.closest(".flex, .grid, [class*='rounded']"); const input = container?.querySelector('input[type="number"]'); if (input) requestAnimationFrame(() => animateNumber(input, numericDirection)); }
      const label = `${button.textContent || ""} ${button.title || ""}`.trim(); const action = ACTIONS.find((item) => item.pattern.test(label)); if (!action || (action.requiresModal && !button.closest(".fixed.inset-0"))) return;
      if (soundOptions.enabled) playActionSound(action, soundOptions.volume);
      if (!enabled) return;
      button.classList.add("action-feedback"); setTimeout(() => button.isConnected && button.classList.remove("action-feedback"), 700);
      if (action.inline && button.isConnected) { button.classList.add("action-button-host"); const sweep = document.createElement("span"); sweep.className = "button-success-sweep"; sweep.textContent = `✓ ${action.message}`; button.appendChild(sweep); setTimeout(() => sweep.classList.add("leaving"), Math.max(500, durationMs - 260)); setTimeout(() => { sweep.remove(); button.classList.remove("action-button-host"); }, durationMs); return; }
      const toast = document.createElement("div"); toast.className = `action-toast ${action.danger ? "danger" : ""}`; toast.textContent = `✓ ${action.message}`; document.body.appendChild(toast); setTimeout(() => toast.classList.add("visible"), 10); setTimeout(() => { toast.classList.remove("visible"); setTimeout(() => toast.remove(), 180); }, durationMs);
    };
    const focus = (event) => { if (event.target.matches?.('input[type="number"]')) values.set(event.target, Number(event.target.value)); };
    const inputChange = (event) => { const input = event.target; if (!input.matches?.('input[type="number"]')) return; const previous = values.has(input) ? values.get(input) : Number(input.defaultValue || 0); const next = Number(input.value); if (enabled && Number.isFinite(previous) && Number.isFinite(next) && next !== previous) animateNumber(input, next > previous ? 1 : -1); values.set(input, next); };
    const invalid = (event) => { if (!enabled) return; event.target.classList.add("field-invalid-animation"); setTimeout(() => event.target.classList.remove("field-invalid-animation"), 450); };
    document.addEventListener("click", click); document.addEventListener("focusin", focus); document.addEventListener("input", inputChange); document.addEventListener("invalid", invalid, true);
    return () => { document.removeEventListener("click", click); document.removeEventListener("focusin", focus); document.removeEventListener("input", inputChange); document.removeEventListener("invalid", invalid, true); };
  }, [enabled, durationSeconds, soundOptions.enabled, soundOptions.volume]);
}
