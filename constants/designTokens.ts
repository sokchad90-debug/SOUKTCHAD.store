/**
 * Design tokens — sole source for the unified card palette (v8.03 base).
 * Rule: one color = one meaning.
 */
export const DT = {
  color: {
    verified: '#2F80ED',   // blue = verified badge only
    danger:   '#EF4444',   // red = offers/discounts only
    success:  '#16A34A',   // green = stock / free shipping only
    primary:  '#5B4FE9',   // purple = price / primary actions only
  },
  dark: {
    verified: '#60A5FA',
    success:  '#4ADE80',
    danger:   '#F87171',
    primary:  '#818CF8',
  },
  card: {
    radius: 14,
  },
} as const;
