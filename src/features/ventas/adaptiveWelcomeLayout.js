const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function calculateAdaptiveWelcomeLayout({ width, height, titleLength = 0, subtitleLength = 0, preview = false }) {
  const safeWidth = Math.max(12, Number(width) || 0);
  const safeHeight = Math.max(12, Number(height) || 0);
  const density = clamp(((titleLength - 12) / 58) + Math.max(0, subtitleLength - 28) / 150, 0, 1);
  const aspect = safeWidth / safeHeight;
  const horizontal = aspect >= (2.15 - density * .18);
  const smallestSide = Math.min(safeWidth, safeHeight);
  const padding = clamp(smallestSide * .055, preview ? 2 : 4, preview ? 10 : 26);
  const gap = clamp(smallestSide * .045, preview ? 2 : 4, preview ? 10 : 22);
  const availableWidth = Math.max(12, safeWidth - padding * 2);
  const availableHeight = Math.max(12, safeHeight - padding * 2);
  const iconSize = horizontal
    ? Math.min(availableHeight * .62, availableWidth * (.2 - density * .035), preview ? 72 : 150)
    : Math.min(availableWidth * .27, availableHeight * (.27 - density * .045), preview ? 72 : 150);
  const maximumTitle = clamp(
    horizontal
      ? Math.min(availableHeight * .43, availableWidth * (.16 - density * .025))
      : Math.min(availableHeight * (.3 - density * .035), availableWidth * (.2 - density * .03)),
    preview ? 5.5 : 8,
    preview ? 44 : 140,
  );

  return {
    orientation: horizontal ? "horizontal" : "vertical",
    padding,
    gap,
    iconSize: Math.max(preview ? 10 : 18, iconSize),
    maximumTitle,
    density,
  };
}
