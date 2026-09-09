# Sokchad Design System

> **Source of Truth:** GOLDEN_PHONE_REFERENCE_FINAL.png + golden-layout.json
> **Authority:** Golden Reference (user-approved) > this file > any other design assumption
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
| Header (Sokchad title) | 52 | 39 | 0 |
| Search bar | 92 | 43 | 0 |
| **Offers Banner** | 136 | 116 | 1 |
| Categories (4 icons) | 252 | 57 | 0 |
| Gap | 311 | 8 | — |
| Verified Stores | 319 | 103 | 8 |
| Sponsored Products | 422 | — | 0 |
| Recently Added | 435 | — | — |
| Bottom Navigation | 799 | 14 | ~4 |

## Key Formulas

```
BANNER_HEIGHT = clamp(100, contentWidth * 0.32, 130)  // 116dp on 361dp
SEARCH_BAR_H = scale(40)
HEADER_HEIGHT = screenHeight * 0.025
cardWidth = (contentWidth - cardGap) / 2
recentImageHeight = recentCardWidth * 0.65
```

## Section Order (immutable)

1. Sokchad header (collapsible)
2. Search bar + Filter button (sticky)
3. Offers Banner (FlashDealsBanner)
4. Categories (4 icons: Tout, Électronique, Vêtements, Chaussures)
5. Boutiques vérifiées (3 stores)
6. Produits sponsorisés (horizontal scroll)
7. Récemment ajoutés (2-column grid)
8. Bottom Navigation (fixed, outside scroll)

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
- Banner = width-based (contentWidth × 0.32), NOT screen-height based
- 2-column layout always on phone portrait
- `maxContentWidth = 480dp` for tablets/wide screens
- `paddingBottom = tabBarHeight + scale(2)` (minimal bottom gap)

## First Viewport Rule

In HOME TOP (scroll = 0):
- ✅ Must show: Banner + Categories + Verified + Sponsored + Recently Row 1 (complete)
- ❌ Must NOT show: Row 2 of Recently Added (not even 1px)
- Bottom Nav must not overlap content
- Safe gap between Row 1 and Bottom Nav: 4–8dp

## Image Rules

- Product images: `resizeMode: cover`, `aspectRatio: 0.65` (height/width)
- Banner background: `contentFit: cover`, fills 100% of container
- All images: `overflow: hidden`, consistent `borderRadius`

## Golden Reference Policy

- GOLDEN_PHONE_REFERENCE_FINAL.png is the **only** visual authority
- Golden Reference does NOT change without explicit user approval
- Do NOT use emulator screenshots as new Golden Reference
- golden-layout.json contains extracted geometry — use it for comparisons