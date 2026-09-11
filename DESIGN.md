# Sokchad Design System

> **Source of Truth:** the user-provided French and Arabic phone references + `golden-layout.json`
> **Authority:** latest user references > this file > any earlier design assumption
> **Platform:** React Native / Expo (Android + iOS)
> **Languages:** AR (RTL) + FR (LTR) + EN (LTR)
> **Theme:** Light + Dark

## Viewport

| Property | Value |
|---|---|
| Reference width | 393dp (1080px @ 440dpi) |
| Reference height | 829dp (2280px @ 440dpi) |
| Content width | 361dp (screen - 16dp padding each side) |
| Safe area top | 52dp (status bar) |
| Safe area bottom | 17dp (home indicator) |

## Layout Tokens (from Golden Reference)

| Section | Top (dp) | Height (dp) | Gap from prev (dp) |
|---|---|---|---|
| Status bar | 0 | 52 | — |
| Header | — | 50–58 | 0 |
| Search bar | — | 44–50 | 4–8 |
| Categories | — | one row, 4 items | 0 |
| Verified Stores | — | 3 equal items | 6–12 |
| Sponsored Products | — | 3 visible cards | 0 |
| Recently Added | — | 2-column grid | — |
| Bottom Navigation | — | 56 + safe area | 4–8 |

## Key Formulas

```
SURFACE_WIDTH = min(windowWidth - safeInsets, 480)
SEARCH_BAR_H = clamp(41, widthFactor * 43, 47)   // canonical = 43dp @393dp (v8.9.36, user-requested -2%)
HEADER_HEIGHT = clamp(50, widthFactor * 54, 58)
cardWidth = (contentWidth - cardGap) / 2         // or containerWidth when the grid parent measures itself
recentImageHeight = recentCardWidth * 0.78
LIST_TOP_PULL = 12                               // gap: sticky bottom → first section = scale(14)-12 = 2dp net (v8.9.36, pull products up ~0.5%)
BOTTOM_NAV_CONTENT_GAP = 14                      // design gap: last card → bottom nav (v8.9.30 approved)
```

## Section Order (immutable)

1. Sokchad header (collapsible)
2. Search bar + Filter button (sticky)
3. Categories (4 icons: Tout, Électronique, Vêtements, Chaussures)
4. Boutiques vérifiées (3 stores)
5. Produits sponsorisés (3 visible cards)
6. Récemment ajoutés (2-column grid)
7. Bottom Navigation (fixed, outside scroll)

## Typography

| Element | Size | Weight |
|---|---|---|
| Sokchad logo | scale(18) | 800 (Cairo-Bold) |
| Section titles | scale(14) | 700 (Cairo-Bold) |
| Product name | scale(12) | 600 (Cairo-SemiBold) |
| Product price | scale(13) | 800 (Cairo-Bold) |
| Search input | scale(13) | 400 |
| City/Stock | scale(10) | 400 |

## Colors

| Token | Light | Dark |
|---|---|---|
| background | #F8FAFC | #0F172A |
| surface | #FFFFFF | #1E293B |
| primary | #3B82F6 | #3B82F6 |
| text | #0F172A | #F8FAFC |
| border | #E2E8F0 | #334155 |

## Responsive Rules

- Use `useWindowDimensions()` + `useSafeAreaInsets()` — NEVER device model checks
- `scale()` = clamp(0.88, width / 390, 1.12) × value
- 2-column layout always on phone portrait
- The complete phone surface is capped at `480dp` and centered on tablets/wide screens
- `paddingBottom = tabBarHeight(measured) + smallGap + BOTTOM_NAV_CONTENT_GAP(14)` — the Navigator reserves the tab bar height (MeasuredTabBar is NOT absolute); the +14 is the approved design gap that keeps the last card fully visible
- `paddingTop = measuredStickyHeight - LIST_TOP_PULL(8)` — the measured relationship between sticky header bottom and the first section (NOT an arbitrary offset)
- Static values from `constants/responsive` (SEARCH_BAR_H, CARD_WIDTH, SCREEN_WIDTH…) are module-load snapshots for legacy styles only — reactive code MUST use `usePhoneLayout()`; the bridge file stays a re-export, no parallel system

## Typography Scaling

- `allowFontScaling` stays ON everywhere; never divide sizes by fontScale
- Use `AppText`/`AppTextInput` (`components/AppText.tsx`) for Cairo family + `maxFontSizeMultiplier` (default 1.35)
- Containers grow and wrap at large font sizes; never clip price or primary action
- Touch targets ≥48dp where interactive (header uses 43-44dp icon buttons with hitSlop compensation — approved)

## First Viewport Rule

In HOME TOP (scroll = 0):
- ✅ Must show: Categories + Verified + Sponsored + the start of Recently Added
- ❌ Must NOT show: Row 2 of Recently Added (not even 1px) — **bound to the approved reference state only** (393×829dp, FR, fontScale 1.0, gesture nav). On shorter/taller windows or larger fontScale the amount of pre-scroll content may differ; composition (order, columns, ratios) may not.
- Bottom Nav must not overlap content
- Safe gap between Row 1 and Bottom Nav: 4–8dp

## Image Rules

- Product images: `contentFit: cover`, ratio height/width = **0.78** (`height = width × 0.78`, `aspectRatio = 1/0.78`)
- `ProductImage.frameRatio` is **width/height of the frame** (`h = w / frameRatio`) — never invert it
- All images: `overflow: hidden`, consistent `borderRadius`; frame dimensions held during load AND failure (fallback keeps the exact frame)
- `cover` crops edges only (marketplace reference look); `contain` reserved for contexts where the whole image matters (per approved references)

## Golden Reference Policy

- The **user's approved screenshots** (img_598410a40fb4 / img_b1194ced8103, 1080×2280 @440dpi = 393×829dp) are the only visual authority — documented in `docs/GOLDEN_REFERENCE_DEVICE.md`
- GOLDEN_PHONE_REFERENCE_FINAL.png is NOT in the repo; do not fabricate it
- Golden Reference does NOT change without explicit user approval
- Do NOT use emulator screenshots as new Golden Reference
- golden-layout.json contains extracted geometry — use it for comparisons
- Comparisons require same language (FR), theme (Light), fontScale (1.0), scroll position, and same window dp

## Android Version Support (honest statement)

- Lockfile: React Native **0.79.3** — official minimum **API 24 / Android 7.0**
- Merged manifest of shipped APKs: `minSdkVersion=24`, `targetSdkVersion=35`
- **Android 6 / API 23 is NOT officially supported by this stack.** Any API23 claim requires a separate compatibility track (RN ≤0.75 downgrade) — explicitly out of scope for UI fixes. See `docs/UI_CONSISTENCY_AUDIT.md` for the full verdict.
