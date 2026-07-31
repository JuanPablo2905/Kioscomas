function resizeScreenshot(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1400 / image.width, 900 / image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.76));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function captureAppScreenshot() {
  try {
    if (window.kioscoDesktop?.captureScreenshot) {
      const result = await window.kioscoDesktop.captureScreenshot();
      if (!result?.ok || !result.dataUrl) return null;
      return await resizeScreenshot(result.dataUrl);
    }
    return null;
  } catch (error) {
    console.warn("No se pudo tomar la captura automática", error);
    return null;
  }
}
