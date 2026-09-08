/** Width is the live, measured content container, after horizontal safe areas. */
export function getHomeGeometry(width: number, fontScale: number) {
  const padding = width * 0.04;
  const cardGap = width * 0.02;
  return {
    padding,
    cardGap,
    cardWidth: (width - padding * 2 - cardGap) / 2,
    pinnedCardWidth: width * 0.29,
    avatarSize: width * 0.14,
    searchHeight: Math.max(44, 22 * fontScale + 16),
    searchButtonWidth: Math.max(44, width * 0.11),
  };
}
