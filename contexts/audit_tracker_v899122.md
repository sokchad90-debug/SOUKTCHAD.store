# AUDIT TRACKING LIST — v8.9.122 full-app review (owner mandate 2026-09-24)
# Deep audit COMPLETE (subagent, 16 screens, 40 findings). Format:
# screen | problem | fix | test(AR/FR, sizes) | result
# Legend: [x]=done+verified  T=tested  S=shots  P=pending

# === P1 (crash/clip/RTL-broken) — from deep audit ===
# C1 conversation:195-206 | chat bubbles NOT mirrored in AR (my msgs always right, wrong radius) | isAr-aware swap msgRow + radius | P
# C2 chats:242-249,291-301 | conv row/name/status rows no row-reverse in AR | add isAr + textAlign | P
# C3 index:1040-1042 | city modal rows no RTL | add isAr row-reverse | P
# C4 store-profile:244-257 | empty store = section vanishes, NO empty state | add empty msg + CTA | P
# C5 flash-deals:8,45 | reads mockData products const not useApp() DB products | switch to useApp | P
# C6 profile:1078 | Clipboard from react-native (deprecated/undefined) → crash on tap | use expo-clipboard setStringAsync (line 1241 pattern) | P
# C7 seller-orders:304-323 | tabs+rows all LTR in AR | row-reverse + align | P

# === P2 (consistency) ===
# C8 promoted:32-35 | 'SPONSORISÉ' hardcoded FR + #8B5CF6 | lb + colors.primary | P
# C9 store-profile:263 | HEADER_BG #6366F1 ≠ identity #5B48D9 | colors.primary | P
# C10 index:591-630 | city modal hardcoded #8B5CF6×6 | colors.primary | P
# C11 index:870-874 | filterBadge #EF4444 in static styles → move to JSX colors.error | P
# C12 seller-orders:75-93 | status colors hex vs profile theme colors | unify theme | P
# C13 grids RTL ×4 (verified-stores:104, store-profile:254, promoted:66, profile:1689,1339) | P
# C14 favorites:84-91 | title/counter no isAr textAlign | P
# C15 all-categories:99-105 | card no row-reverse + marginRight:auto trick | P
# C16 settings:294-308 + seller-settings:334-355 | rows no RTL | P
# C17 fonts <scale(11) ×6 (index:917,874,928-930; seller-orders:308; chats:303) | P
# C18 buttons <scale(40) ×3 (sell:772,820-821; seller-settings:349) | P
# C19 chats:328-334 unreadBadge fixed width clips ≥10 | minWidth+padding | P
# C20 seller-orders:300 summaryValue price clips 320dp | numberOfLines+adjustsFontSize | P
# C21 profile:1758 + settings:714 modals no insets.bottom paddingBottom | P
# C22 order:247 qty row shows literal 1 not quantity variable | P
# C23 order:63,264 total ≠ price*qty (invoice differs) | unify | P
# C24 conversation:62,82 'Buyer'/'Seller'/'not found' English-only | lb() | P
# C25 flash-deals:12-29 countdown '10d 16h 24m' not localized | j/h/m + ي/س/د | P

# === P3 (cosmetic) ===
# C26 chats:10 unused ChatListSkeleton import (use during load or remove) | P
# C27 fake pull-refresh ×2 (chats 21-25, seller-orders 69-73) | real refresh or remove | P
# C28 promoted:83-96 dead styles | remove | P
# C29 index:833-848,940-949 dead styles + hitSlop 10/12 inconsistent | P
# C30 index:841,849,839 raw header dims (43×43, 68×34, padding 8) | scale() | P
# C31 index:924-926 pinnedImage dead static style | remove | P
# C32 index:463 empty-state image cover crops illustration | contain | P
# C33 seller-settings:213,218 store name/phone TextInputs NO placeholder text | P
# C34 seller-settings:71-82 shippingLoading stuck true if user?.id fails | always unset | P
# C35 language modal flags marginRight → marginStart (profile:1560, settings:620) | P
# C36 store-profile:216-239 header row tight on 320dp (name squeezed) | flexShrink | P
# C37 profile:1157 reviewDate no locale | pass locale | P
# C38 sell:708-734 image preview modal raw px + #4C1CEA/#10B981/#F1F5F9 | scale+theme | P
# C39 category image borderRadius raw 10 ×2 (index:117, all-categories:48) | scale(10) | P
# C40 index:649 no load-more footer indicator on onEndReached | ListFooter spinner | P

# === BATCH PLAN (each: fix → AR/FR small/mid/large emulator → before/after shots → commit) ===
# B1 = P1 crash-class: C1 C2 C3 C6 C7 + C4 (chat/chats/city-modal/store-empty/clipboard/flash)
# B2 = RTL sweep: C13 C14 C15 C16 C35
# B3 = i18n + data: C5(=C5 P1) C8 C22 C23 C24 C25 C33 C34
# B4 = readability/space: C17 C18 C19 C20 C21 C36 + P3 dead styles C26-32 C37-40
# NOTE F1 from earlier static pass merged into C38 (same modal).
# open question to owner: unified 'no connection' state for failed fetches — asked, awaiting