import React, { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, Keyboard, Loader2, PackageCheck, ScanLine, X } from "lucide-react";
import { BrowserMultiFormatOneDReader } from "@zxing/browser";
import { decodeEanFromVideo } from "./eanDecoder";

export function ScanModal({ onClose, onDetected, products = [], preferences = {}, continuous = false, initialMode = "manual", confirmationTitle, confirmLabel, resolveCode, allowAnyCode = false }) {
  const [mode, setMode] = useState(initialMode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pending, setPending] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const controlsRef = useRef(null);
  const detectingRef = useRef(false);

  const stopCamera = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  const prepareConfirmation = async (value) => {
    if (!value || loading || resolving || detectingRef.current) return;
    detectingRef.current = true;
    stopCamera();
    const normalized = String(value).trim();
    const product = products.find((item) => String(item.codigo || "").trim() === normalized);
    setResolving(true);
    let resolution = null;
    try {
      resolution = await Promise.resolve(resolveCode?.(normalized) || null);
    } catch {
      resolution = null;
    }
    if (preferences.scanFeedback !== false) {
      navigator.vibrate?.(80);
      if (preferences.sounds) try { const Audio = window.AudioContext || window.webkitAudioContext; const audio = new Audio(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.frequency.value = 880; gain.gain.value = Math.max(0, Math.min(1, Number(preferences.volume ?? 70) / 100)) * .08; oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .08); } catch {}
    }
    setPending({ code: normalized, product, ...resolution });
    setResolving(false);
  };

  const confirmDetected = async () => {
    if (!pending || loading) return;
    setLoading(true);
    setError("");
    try {
      const processed = await onDetected(pending.code, pending);
      if (continuous && processed !== false) continueScanning();
    } catch {
      setError("No se pudo procesar el código. Podés escribirlo manualmente.");
      detectingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const cancelConfirmation = () => {
    if (continuous && mode === "camera") {
      continueScanning();
      return;
    }
    setPending(null);
    setCode("");
    setMode("manual");
    detectingRef.current = false;
  };

  const startCamera = async () => {
    setMode("camera");
    setError("");
    detectingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara no está disponible en este dispositivo.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: preferences.preferredCamera === "frontal" ? "user" : "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, focusMode: { ideal: "continuous" } },
        audio: false,
      });
      streamRef.current = stream;
      const cameraTrack = stream.getVideoTracks()[0];
      setTorchAvailable(Boolean(cameraTrack?.getCapabilities?.().torch));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const zxingReader = new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 90, delayBetweenScanSuccess: 400 });
      controlsRef.current = await zxingReader.decodeFromStream(stream, videoRef.current, (result) => {
        const value = result?.getText?.();
        if (value && !detectingRef.current) prepareConfirmation(value);
      });

      let detector = null;
      if ("BarcodeDetector" in window) {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"].filter((item) => supported.includes(item));
        detector = new window.BarcodeDetector(formats.length ? { formats } : undefined);
      }
      let lastNative = 0;
      let lastFallback = 0;
      const scan = async (time = 0) => {
        if (!streamRef.current || detectingRef.current) return;
        try {
          if (videoRef.current?.readyState >= 2) {
            let value = null;
            if (detector && time - lastNative > 180) {
              lastNative = time;
              value = (await detector.detect(videoRef.current))[0]?.rawValue || null;
            }
            if (!value && time - lastFallback > 140) {
              lastFallback = time;
              value = decodeEanFromVideo(videoRef.current, canvasRef.current);
            }
            if (value) {
              prepareConfirmation(value);
              return;
            }
          }
        } catch {}
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (reason) {
      setError(reason?.name === "NotAllowedError" ? "No se otorgó permiso para usar la cámara. Habilitalo en Windows y volvé a probar." : "No pudimos abrir la cámara. Verificá que no esté siendo usada por otra aplicación.");
      stopCamera();
    }
  };

  const continueScanning = () => {
    const cameraMode = mode === "camera";
    setPending(null);
    setCode("");
    setError("");
    detectingRef.current = false;
    if (cameraMode) window.setTimeout(() => startCamera(), 120);
  };

  useEffect(() => {
    if (initialMode !== "camera") return undefined;
    const timer = window.setTimeout(() => startCamera(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const selectMode = (next) => {
    if (next === "manual") {
      stopCamera();
      setMode("manual");
      setError("");
    } else startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="scan-modal-title">
      <canvas ref={canvasRef} className="hidden" />
      <div
        className="w-full max-w-md overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl bg-white p-4 text-center sm:p-6"
        style={{ maxHeight: "calc(var(--app-viewport-height, 100dvh) - 1rem)" }}
      >
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3 text-left">
          <h2 id="scan-modal-title" className="min-w-0 break-words pt-2 text-lg font-bold">{pending ? (confirmationTitle || "Confirmar producto") : "Escanear código"}</h2>
          <button onClick={() => { stopCamera(); onClose(); }} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        {resolving ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border bg-gray-50 p-6">
            <Loader2 className="animate-spin text-green-600" size={34} />
            <p className="mt-3 text-sm font-semibold text-gray-700">Buscando el producto…</p>
            <p className="mt-1 text-xs text-gray-500">Consultando stock y catálogos disponibles.</p>
          </div>
        ) : pending ? (
          <div>
            <div className="mb-4 min-w-0 rounded-xl border bg-gray-50 p-4 sm:p-5">
              <PackageCheck className="mx-auto mb-3 text-green-600" size={38} />
              <p className="text-xs uppercase tracking-wide text-gray-400">{pending.kind === "ticket" ? "Ticket detectado" : pending.kind === "unknown" ? "Código detectado" : "Producto detectado"}</p>
              <p className="mt-1 break-words text-lg font-bold">{pending.displayName || pending.product?.nombre || "Producto no registrado"}</p>
              <p className="mt-1 break-all font-mono text-sm text-gray-500">{pending.code}</p>
              {pending.product && <p className="mt-2 break-words text-sm text-gray-600">Precio: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(pending.product.venta) || 0)}</p>}
            </div>
            {continuous && !pending.product && !pending.kind && <p className="mb-3 break-words rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Este producto no está cargado en el stock. Cancelá para continuar escaneando.</p>}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button onClick={cancelConfirmation} className="min-h-11 min-w-0 break-words rounded-lg border px-2 py-2 text-sm sm:px-4">{continuous ? "Seguir escaneando" : "Cancelar"}</button>
              <button onClick={confirmDetected} disabled={loading || (continuous && !pending.product && !pending.kind && !allowAnyCode)} className="min-h-11 min-w-0 break-words rounded-lg bg-green-600 px-2 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:px-4">{loading ? "Procesando..." : confirmLabel || (pending.product ? "Sí, agregar" : "Continuar")}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <button onClick={() => selectMode("manual")} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-2 py-2 text-sm sm:gap-2 sm:px-3 ${mode === "manual" ? "bg-white shadow-sm" : "text-gray-500"}`}><Keyboard className="shrink-0" size={16} /><span className="min-w-0 break-words">Lector / teclado</span></button>
              <button onClick={() => selectMode("camera")} className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-2 py-2 text-sm sm:gap-2 sm:px-3 ${mode === "camera" ? "bg-white shadow-sm" : "text-gray-500"}`}><Camera className="shrink-0" size={16} /><span className="min-w-0">Cámara</span></button>
            </div>
            {mode === "camera" ? (
              <div>
                <div className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-gray-900">
                  <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                  {torchAvailable && <button type="button" onClick={toggleTorch} className={`absolute right-3 top-3 z-10 flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-lg ${torchOn ? "bg-amber-400 text-gray-950" : "bg-black/65 text-white"}`}><Flashlight size={16}/>{torchOn ? "Apagar flash" : "Encender flash"}</button>}
                  <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.25)]" />
                  <ScanLine className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white" />
                  {!cameraActive && !error && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                </div>
                <p className="break-words text-xs text-gray-500">Apuntá la cámara al código, mantenelo horizontal y dentro del recuadro.</p>
                {cameraActive && <p className="mt-2 break-words rounded-lg bg-blue-50 p-2 text-xs text-blue-700">Lector avanzado ZXing activo, con detector alternativo de respaldo.</p>}
                {error && <button onClick={startCamera} className="mt-3 min-h-11 rounded-lg border px-3 py-2 text-sm">Reintentar cámara</button>}
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-gray-100 sm:h-28"><ScanLine size={34} className="text-gray-400" /></div>
                <p className="mb-3 break-words text-xs text-gray-500">Usá un lector USB o escribí el código. Presioná Enter para buscar.</p>
                <input autoFocus value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && prepareConfirmation(code)} placeholder="Código de barras" className="mb-3 min-h-11 w-full rounded-lg border px-3 py-2 text-base sm:text-sm" />
                <button onClick={() => prepareConfirmation(code)} disabled={!code.trim() || loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">Buscar producto</button>
              </>
            )}
          </>
        )}
        {error && <p className="mt-3 break-words rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
