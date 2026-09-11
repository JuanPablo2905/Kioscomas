const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateAdaptiveSocialLayout({ width, height, contentLength = 0, wordCount = 0, hasQr = true, preview = false }) {
  const safeWidth = Math.max(12, Number(width) || 0);
  const safeHeight = Math.max(12, Number(height) || 0);
  const density = clamp(((contentLength - 24) / 76) + Math.max(0, wordCount - 7) * .018, 0, 1);
  const aspect = safeWidth / safeHeight;
  const horizontal = hasQr && aspect >= (1.58 - density * .22);
  const smallestSide = Math.min(safeWidth, safeHeight);
  const padding = clamp(smallestSide * .06, 3, 18);
  const gap = clamp(smallestSide * .045, 3, 14);
  const availableHeight = Math.max(12, safeHeight - padding * 2);
  const availableWidth = Math.max(12, safeWidth - padding * 2);
  const qrSize = hasQr
    ? horizontal
      ? Math.max(12, Math.min(availableHeight, safeWidth * (.37 - density * .08), 160))
      : Math.max(12, Math.min(availableWidth * .68, safeHeight * (.46 - density * .09), 160))
    : 0;
  const maximumTitle = clamp(
    horizontal
      ? Math.min(safeHeight * .19, safeWidth * .072)
      : Math.min(safeHeight * .095, safeWidth * .09),
    8,
    preview ? 22 : 30,
  );
  return { orientation: horizontal ? "horizontal" : "vertical", padding, gap, qrSize, maximumTitle, density };
}
