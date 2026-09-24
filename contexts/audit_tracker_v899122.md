# AUDIT TRACKING LIST — v8.9.122 full-app review (owner mandate 2026-09-24)
# Format: screen | problem | fix | test | result — [x]=verified
## Screens (34): see inventory in git history of this file
## Buyer tabs: index, categories(v121✓), services-tab, chats, favorites, profile
## Buyer flows: product(v117-118✓), checkout(v119✓), order✓empty-state-ok, seller,
##   conversation, all-products(scale✓), all-categories, flash-deals, promoted,
##   verified-stores, settings, privacy-policy, +not-found
## Seller: sell, seller-orders✓empty, seller-analytics, seller-stats, seller-settings-tab,
##   store-profile, seller-settings, seller-payments, seller/invoices, verification
## Shared: ProductCard, ProductImage, Skeleton, AppText, LoginModal, DisclaimerBanner

# === AUDIT FINDINGS ===
# P1:
# F1 sell.tsx:715-718 — fixed fontSize 14/12 + raw colors #0F172A/#64748B (modal preview)
#    | fix: scale + theme | PENDING
# F2 conversation/[id].tsx — NO empty-messages state: if conv has 0 messages the list is
#    just disclaimer+product card, no 'start the conversation' hint | fix: PENDING
# F3 conversation/[id].tsx:82 — 'Conversation not found' English-only | fix: PENDING
# P2:
# F4 conversation disclaimer: full text always visible (long, pushes messages down) —
#    consider collapsed 2-line | ASK OWNER? minor, defer to batch
# P3:
# F5 flash-deals timer contrast | verify on emulator
#
# === BATCH PLAN (small reversible; identity frozen) ===
# B1 home + categories + verified-stores → fix → AR/FR small/mid/large emulator → shots
# B2 product + all-products + favorites + services-tab → same
# B3 orders + chats + profile + settings + order/[id] + conversation → same
# B4 sell + seller-settings + store-profile → same
# Per batch: commit (revertible) + before/after shots + checklist rows appended.