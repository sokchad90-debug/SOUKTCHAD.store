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
SEARCH_BAR_H = clamp(44, widthFactor * 46, 50)
HEADER_HEIGHT = clamp(50, widthFactor * 54, 58)
cardWidth = (contentWidth - cardGap) / 2
recentImageHeight = recentCardWidth * 0.78
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
- `paddingBottom = tabBarHeight + scale(2)` (minimal bottom gap)

## First Viewport Rule

In HOME TOP (scroll = 0):
- ✅ Must show: Categories + Verified + Sponsored + the start of Recently Added
- ❌ Must NOT show: Row 2 of Recently Added (not even 1px)
- Bottom Nav must not overlap content
- Safe gap between Row 1 and Bottom Nav: 4–8dp

## Image Rules

- Product images: `contentFit: cover`, `aspectRatio: 0.78` (height/width)
- All images: `overflow: hidden`, consistent `borderRadius`

## Golden Reference Policy

- GOLDEN_PHONE_REFERENCE_FINAL.png is the **only** visual authority
- Golden Reference does NOT change without explicit user approval
- Do NOT use emulator screenshots as new Golden Reference
- golden-layout.json contains extracted geometry — use it for comparisons
