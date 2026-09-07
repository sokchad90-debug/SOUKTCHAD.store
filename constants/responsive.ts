/**
 * Sokchad — Canonical Phone Layout Engine
 * Re-export bridge: constants/responsive.ts → ui/responsive.ts
 * 
 * ALL exports now come from the Canonical Phone Layout Engine.
 * This file exists ONLY for backward import compatibility.
 * 
 * For new code: import from '@/ui/responsive' directly.
 * For existing code: keep importing from '@/constants/responsive' — it works.
 */

export {
  // Core
  clamp,
  getPhoneLayoutMetrics,
  usePhoneLayout,
  PhoneLayoutMetrics,
  
  // Legacy compat (capped at 1.12x — was 1.3x)
  scale,
  scaleFont,
  normalize,
  getScreenWidth,
  getScreenHeight,
  getScale,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  getBannerHeight,
  getStickyHeaderOffset,
  BANNER_HEIGHT,
  STICKY_HEADER_OFFSET,
  IS_SHORT_SCREEN,
  IS_VERY_SHORT_SCREEN,
  getIsShortScreen,
  getIsVeryShortScreen,
  CATEGORY_CIRCLE,
  AVATAR_SIZE,
  AVATAR_RADIUS,
  AVATAR_BORDER,
  VERIFIED_STORE_ITEM_W,
  VERIFIED_BADGE,
  PINNED_CARD_W,
  PINNED_IMG_H,
  SEARCH_BAR_H,
  SEARCH_BTN_W,
  EMPTY_IMG,
  PINNED_DISCOUNT_BADGE,
  NOTIF_BTN,
  LOGO_IMG,
  CARD_WIDTH,
} from '../ui/responsive';