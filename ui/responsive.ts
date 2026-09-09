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

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// CONSTANTS — Canonical Reference Design
// ============================================================

/** Reference phone width in logical DP (Pixel 7 / iPhone 14) */
const REFERENCE_WIDTH = 390;

/** Reference product card image ratio (height / width) — from Golden Reference */
const REFERENCE_IMAGE_RATIO = 0.65;

/** Reference banner ratio (height / screenHeight) — from Golden Reference: 5.3% */
const REFERENCE_BANNER_RATIO = 0.053;

/** Canonical max content width for tablets/large windows */
const CANONICAL_MAX_CONTENT_WIDTH = 480;

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
  searchGap: number; // gap between search and banner

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
  
  const effectiveWidth = width - safeLeft - safeRight;
  const effectiveHeight = height - safeTop - safeBottom;
  
  // ---- Width normalization (controlled, clamped) ----
  // Ratio of effective width to reference width, clamped to prevent extremes
  const widthFactor = clamp(0.88, effectiveWidth / REFERENCE_WIDTH, 1.12);
  
  // ---- Height class (for gap compression only) ----
  const isShortHeight = effectiveHeight < 600;
  const isTallHeight = effectiveHeight > 820;
  // Compression factor: 1.0 = normal, <1.0 = compress gaps
  const heightFactor = isShortHeight ? 0.85 : 1.0;
  
  // ---- Bottom nav ----
  const bottomNavHeight = params.bottomNavHeight ?? 56;
  
  // ---- Layout Tokens ----
  const horizontalPadding = clamp(12, Math.round(effectiveWidth * 0.04), 18);
  const contentWidth = effectiveWidth - horizontalPadding * 2;
  const maxContentWidth = Math.min(contentWidth, CANONICAL_MAX_CONTENT_WIDTH);
  
  const headerHeight = clamp(28, Math.round(widthFactor * 32), 36);
  const searchHeight = clamp(34, Math.round(widthFactor * 40), 46);
  const searchGap = clamp(6, Math.round(heightFactor * 8), 10);
  
  // Banner: proportion of contentWidth, clamped
  const bannerHeight = clamp(100, Math.round(contentWidth * REFERENCE_BANNER_RATIO), 200);
  
  // Section gaps (compressed on short screens)
  const sectionGap = clamp(4, Math.round(heightFactor * 10), 14);
  const smallGap = clamp(2, Math.round(heightFactor * 4), 6);
  
  // Categories — 4 equal items via flex:1
  const categoryCircleSize = clamp(44, Math.round(widthFactor * 52), 60);
  const categoryItemWidth = contentWidth / 4; // flex: 1 in parent
  
  // Verified stores — 3 visible
  const storeAvatarSize = clamp(44, Math.round(widthFactor * 54), 60);
  const storeItemWidth = clamp(80, Math.round(widthFactor * 100), 120);
  
  // Sponsored — horizontal scroll cards
  const sponsoredCardWidth = clamp(90, Math.round(widthFactor * 112), 130);
  const sponsoredImageHeight = clamp(50, Math.round(sponsoredCardWidth * 0.57), 72);
  
  // Recently Added — 2 columns
  const cardGap = clamp(6, Math.round(widthFactor * 10), 12);
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
    safeTop, safeBottom, safeLeft, safeRight,
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

import { Dimensions, PixelRatio } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

let _w = Dimensions.get('window').width;
let _h = Dimensions.get('window').height;

if (Dimensions.addEventListener) {
  Dimensions.addEventListener('change', ({ window }: { window: any }) => {
    if (window?.width) _w = window.width;
    if (window?.height) _h = window.height;
  });
}

const _ratio = () => clamp(0.88, _w / REFERENCE_WIDTH, 1.12);

/** Legacy scale — capped at 1.12x. Use usePhoneLayout() for new code. */
export const scale = (n: number): number => Math.round(n * _ratio());

/**
 * Font scaling with PixelRatio — rounds to the nearest physical pixel for crisp text.
 * Replaces the old `scaleFont = scale` alias. Use for all font sizes.
 */
export const normalize = (size: number): number => {
  const s = _w / REFERENCE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * s));
};
export const scaleFont = normalize;
export const getScreenWidth = () => _w;
export const getScreenHeight = () => _h;
export const getScale = () => _ratio();
export const SCREEN_WIDTH = _w;
export const SCREEN_HEIGHT = _h;

// Sticky header offset = header + search only (scale(32) + scale(40) = scale(72))
export const STICKY_HEADER_OFFSET = scale(72);
export const getStickyHeaderOffset = () => scale(72);
// Banner: height-based (hp) — matches Golden Reference (13% of screen height).
// NO compression tiers. Same proportions on ALL screens.
// Content that doesn't fit → vertical scroll.
const _isShortScreen = false;
const _isVeryShortScreen = false;
export const IS_SHORT_SCREEN = _isShortScreen;
export const IS_VERY_SHORT_SCREEN = _isVeryShortScreen;
export const getIsShortScreen = () => _isShortScreen;
export const getIsVeryShortScreen = () => _isVeryShortScreen;

// ---- Percentage-based dimensions (wp = width %, hp = height %) ----
// Same values on ALL screen sizes. No exceptions.
export const getSearchBarHeight = () => hp('5%');
export const SEARCH_BAR_H = hp('6.5%');
export const getBannerHeight = () => hp('13%');
export const BANNER_HEIGHT = hp('13%');
export const getCategoryCircleSize = () => wp('14%');
export const CATEGORY_CIRCLE = wp('14%');
export const AVATAR_SIZE = wp('14%');
export const AVATAR_RADIUS = wp('7%');
export const AVATAR_BORDER = scale(2);
export const VERIFIED_STORE_ITEM_W = wp('26%');
export const VERIFIED_BADGE = wp('5%');
export const PINNED_CARD_W = wp('29%');
export const PINNED_IMG_H = hp('8%');
export const SEARCH_TO_BANNER_GAP = scale(6);
export const SECTION_SPACING = scale(8);
export const SEARCH_BTN_W = wp('11%');
export const EMPTY_IMG = wp('41%');
export const PINNED_DISCOUNT_BADGE = wp('4.6%');
export const NOTIF_BTN = wp('8%');
export const LOGO_IMG = wp('6%');
export const CARD_WIDTH = wp('45%');