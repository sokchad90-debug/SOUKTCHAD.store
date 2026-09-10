/**
 * Sokchad — Canonical Phone Layout Engine
 *
 * ONE Source of Truth for ALL phone layout decisions.
 * No breakpoints change the phone composition.
 * No device-specific UI. No global unbounded scale().
 *
 * The SAME canonical Home composition on every phone —
 * small, medium, large, old, new, Android, iOS.
 *
 * Architecture:
 * - getPhoneLayoutMetrics() — pure function, produces all Layout Tokens
 * - usePhoneLayout() — React hook, reactive to window + safe area changes
 * - All Home components read from ONE engine
 *
 * Tablets/large windows get maxWidth-capped phone composition (not a different layout).
 */

import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// CONSTANTS — Canonical Reference Design
// ============================================================

/** Reference phone width in logical DP (Pixel 7 / iPhone 14) */
const REFERENCE_WIDTH = 390;

/** Reference product card image ratio (height / width) — from supplied mockups */
const REFERENCE_IMAGE_RATIO = 0.78;

/** Reference banner ratio (height / content width) */
const REFERENCE_BANNER_RATIO = 0.32;

/** Keep the phone composition centred instead of turning tablets into a new UI. */
export const CANONICAL_MAX_SURFACE_WIDTH = 480;

// ============================================================
// CLAMP
// ============================================================
export const clamp = (min: number, preferred: number, max: number): number =>
  Math.min(Math.max(preferred, min), max);

// ============================================================
// PHONE LAYOUT METRICS — The Engine
// ============================================================

export interface PhoneLayoutMetrics {
  // Raw effective space
  effectiveWidth: number;
  effectiveHeight: number;
  windowWidth: number;
  windowHeight: number;
  fontScale: number;
  pixelScale: number;

  // Safe areas
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;

  // Centred application surface (full width on phones, capped on tablets/web)
  surfaceWidth: number;

  // Width normalization factor (clamped)
  widthFactor: number;

  // ---- Layout Tokens (all derived, all clamped) ----

  // Horizontal
  horizontalPadding: number;
  contentWidth: number;
  maxContentWidth: number;

  // Header
  headerHeight: number;

  // Search
  searchHeight: number;
  searchGap: number; // gap after the sticky search area

  // Banner
  bannerHeight: number;

  // Section gaps
  sectionGap: number;
  smallGap: number;

  // Categories
  categoryCircleSize: number;
  categoryItemWidth: number; // = contentWidth / 4 (flex: 1)

  // Verified stores
  storeAvatarSize: number;
  storeItemWidth: number;

  // Sponsored
  sponsoredCardWidth: number;
  sponsoredImageHeight: number;

  // Recently Added
  cardGap: number;
  recentCardWidth: number;
  recentImageHeight: number;

  // Bottom nav
  bottomNavHeight: number;
  contentBottomPadding: number;

  // Sticky header offset (search + gap)
  stickyHeaderOffset: number;

  // Height class (for gap compression only, NOT composition change)
  isShortHeight: boolean;
  isTallHeight: boolean;
  heightFactor: number; // compression factor for short screens
}

/**
 * getPhoneLayoutMetrics — Pure function.
 * Call with window dimensions + safe area insets.
 * Returns ALL layout tokens. ONE source of truth.
 */
export const getPhoneLayoutMetrics = (params: {
  width: number;
  height: number;
  fontScale: number;
  pixelScale: number;
  insets: { top: number; bottom: number; left: number; right: number };
  bottomNavHeight?: number;
}): PhoneLayoutMetrics => {
  const { width, height, fontScale, pixelScale, insets } = params;

  // ---- Effective space ----
  const safeTop = insets?.top ?? 0;
  const safeBottom = insets?.bottom ?? 0;
  const safeLeft = insets?.left ?? 0;
  const safeRight = insets?.right ?? 0;

  const effectiveWidth = Math.max(0, width - safeLeft - safeRight);
  const effectiveHeight = height - safeTop - safeBottom;

  const surfaceWidth = Math.min(effectiveWidth, CANONICAL_MAX_SURFACE_WIDTH);

  // ---- Width normalization (controlled, clamped) ----
  // Ratio of effective width to reference width, clamped to prevent extremes
  const widthFactor = clamp(0.88, surfaceWidth / REFERENCE_WIDTH, 1.12);

  // ---- Height class (for gap compression only) ----
  const isShortHeight = effectiveHeight < 600;
  const isTallHeight = effectiveHeight > 820;
  // Compression factor: 1.0 = normal, <1.0 = compress gaps
  const heightFactor = isShortHeight ? 0.85 : 1.0;

  // ---- Bottom nav ----
  const bottomNavHeight = params.bottomNavHeight ?? 56;

  // ---- Layout Tokens ----
  const horizontalPadding = clamp(12, Math.round(surfaceWidth * 0.04), 18);
  const contentWidth = surfaceWidth - horizontalPadding * 2;
  const maxContentWidth = CANONICAL_MAX_SURFACE_WIDTH - horizontalPadding * 2;

  const headerHeight = clamp(50, Math.round(widthFactor * 54), 58);
  const searchHeight = clamp(44, Math.round(widthFactor * 46), 50);
  const searchGap = clamp(4, Math.round(heightFactor * 6), 8);

  // Banner: proportion of contentWidth, clamped
  const bannerHeight = clamp(100, Math.round(contentWidth * REFERENCE_BANNER_RATIO), 130);

  // Section gaps (compressed on short screens)
  const sectionGap = clamp(6, Math.round(heightFactor * 8), 12);
  const smallGap = clamp(2, Math.round(heightFactor * 4), 6);

  // Categories — 4 equal items via flex:1
  const categoryCircleSize = clamp(48, Math.round(widthFactor * 54), 62);
  const categoryItemWidth = contentWidth / 4; // flex: 1 in parent

  // Verified stores — 3 visible
  const storeAvatarSize = clamp(50, Math.round(widthFactor * 56), 64);
  const storeItemWidth = contentWidth / 3;

  // Sponsored — horizontal scroll cards
  const sponsoredCardWidth = (contentWidth - smallGap * 2) / 3;
  const sponsoredImageHeight = sponsoredCardWidth;

  // Recently Added — 2 columns
  const cardGap = clamp(8, Math.round(widthFactor * 10), 12);
  const recentCardWidth = (contentWidth - cardGap) / 2;
  const recentImageHeight = Math.round(recentCardWidth * REFERENCE_IMAGE_RATIO);

  // Bottom padding — exact bottom nav + safe area + tiny gap
  const contentBottomPadding = bottomNavHeight + clamp(4, Math.round(heightFactor * 6), 8);

  // Sticky header offset = header + search + searchGap
  const stickyHeaderOffset = headerHeight + searchHeight + searchGap;

  return {
    effectiveWidth, effectiveHeight,
    windowWidth: width, windowHeight: height,
    fontScale, pixelScale,
    safeTop, safeBottom, safeLeft, safeRight, surfaceWidth,
    widthFactor,
    horizontalPadding, contentWidth, maxContentWidth,
    headerHeight,
    searchHeight, searchGap,
    bannerHeight,
    sectionGap, smallGap,
    categoryCircleSize, categoryItemWidth,
    storeAvatarSize, storeItemWidth,
    sponsoredCardWidth, sponsoredImageHeight,
    cardGap, recentCardWidth, recentImageHeight,
    bottomNavHeight, contentBottomPadding,
    stickyHeaderOffset,
    isShortHeight, isTallHeight, heightFactor,
  };
};

/**
 * usePhoneLayout — React hook for reactive layout.
 * Must be used inside SafeAreaProvider.
 */
export const usePhoneLayout = (bottomNavHeight?: number): PhoneLayoutMetrics => {
  const { width, height, fontScale, scale: pixelScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return getPhoneLayoutMetrics({
    width, height, fontScale, pixelScale,
    insets: {
      top: insets?.top ?? 0,
      bottom: insets?.bottom ?? 0,
      left: insets?.left ?? 0,
      right: insets?.right ?? 0,
    },
    bottomNavHeight,
  });
};

// ============================================================
// LEGACY COMPATIBILITY — re-export from old constants/responsive
// ============================================================
// These allow 30+ files to keep working during gradual migration.
// The goal is to eventually replace ALL of these with usePhoneLayout().

let _w = Dimensions.get('window').width;
let _h = Dimensions.get('window').height;

if (Dimensions.addEventListener) {
  Dimensions.addEventListener('change', ({ window }: { window: any }) => {
    if (window?.width) _w = window.width;
    if (window?.height) _h = window.height;
  });
}

const _ratio = () => clamp(0.88, _w / REFERENCE_WIDTH, 1.12);
const _surfaceWidth = () => Math.min(_w, CANONICAL_MAX_SURFACE_WIDTH);
const _horizontalPadding = () => clamp(12, Math.round(_surfaceWidth() * 0.04), 18);
const _contentWidth = () => _surfaceWidth() - _horizontalPadding() * 2;

/** Legacy scale — capped at 1.12x. Use usePhoneLayout() for new code. */
export const scale = (n: number): number => Math.round(n * _ratio());

/**
 * Font scaling with PixelRatio — rounds to the nearest physical pixel for crisp text.
 * Replaces the old `scaleFont = scale` alias. Use for all font sizes.
 */
export const normalize = (size: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel(size * _ratio()));
};
export const scaleFont = normalize;
export const getScreenWidth = () => _w;
export const getScreenHeight = () => _h;
export const getScale = () => _ratio();
export const SCREEN_WIDTH = _w;
export const SCREEN_HEIGHT = _h;

// Legacy sticky header offset = canonical header + search + compact gap.
export const STICKY_HEADER_OFFSET = scale(106);
export const getStickyHeaderOffset = () => scale(106);
// The phone composition stays constant; short screens scroll instead of dropping sections.
const _isShortScreen = false;
const _isVeryShortScreen = false;
export const IS_SHORT_SCREEN = _isShortScreen;
export const IS_VERY_SHORT_SCREEN = _isVeryShortScreen;
export const getIsShortScreen = () => _isShortScreen;
export const getIsVeryShortScreen = () => _isVeryShortScreen;

// ---- Canonical dimensions (phone layout, capped on wide screens) ----
export const HORIZONTAL_PADDING = _horizontalPadding();
export const CONTENT_WIDTH = _contentWidth();
export const CARD_GAP = scale(10);
export const PRODUCT_IMAGE_RATIO = REFERENCE_IMAGE_RATIO;
export const getCardWidth = () => Math.floor((_contentWidth() - scale(10)) / 2);

export const SEARCH_BAR_H_BASE = 46;
export const getSearchBarH = (fontScale: number = 1) =>
  clamp(44, Math.round(46 * _ratio() * Math.min(fontScale, 1.12)), 52);
export const getSearchBarHeight = getSearchBarH;
export const SEARCH_BAR_H = getSearchBarH();
export const getBannerHeight = () => clamp(100, Math.round(_contentWidth() * REFERENCE_BANNER_RATIO), 130);
export const BANNER_HEIGHT = getBannerHeight();
export const getCategoryCircleSize = () => clamp(48, Math.round(54 * _ratio()), 62);
export const CATEGORY_CIRCLE = getCategoryCircleSize();

export const AVATAR_SIZE = clamp(50, Math.round(56 * _ratio()), 64);
export const AVATAR_RADIUS = Math.round(AVATAR_SIZE / 2);
export const AVATAR_BORDER = scale(2);
export const VERIFIED_STORE_ITEM_W = Math.floor(CONTENT_WIDTH / 3);
export const VERIFIED_BADGE = clamp(18, scale(20), 22);
export const PINNED_CARD_W = Math.floor((CONTENT_WIDTH - scale(12)) / 3);
export const PINNED_IMG_H = PINNED_CARD_W;
export const SEARCH_TO_BANNER_GAP = scale(6);
export const SECTION_SPACING = scale(8);
export const SEARCH_BTN_W = SEARCH_BAR_H;
export const EMPTY_IMG = clamp(132, Math.round(CONTENT_WIDTH * 0.41), 176);
export const PINNED_DISCOUNT_BADGE = scale(18);
export const NOTIF_BTN = clamp(30, scale(32), 36);
export const LOGO_IMG = clamp(22, scale(24), 28);
export const CARD_WIDTH = getCardWidth();
