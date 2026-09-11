# Phase 2-3 Audit — نتائج التدقيق الفعلي (v8.9.30 → v8.9.31)

## المكتشف أثناء التدقيق (بأدلة من الكود)

### A. تعارضات القيم الثابتة (مصدران لنفس القيمة)
| الرمز | ui/responsive.ts (المحرك) | constants/responsive.ts (الجسر) | DESIGN.md | golden-layout.json |
|---|---|---|---|---|
| searchHeight | `clamp(42, widthFactor*44, 48)` (بعد v8.9.28) | `getSearchBarH = clamp(44, 46*ratio*min(fs,1.12), 52)` + `SEARCH_BAR_H_BASE=46` | `clamp(44, w*46, 50)` | `clamp(44, w*46, 50)` |
| SEARCH_BAR_H (مستعمل في styles الرئيسية) | — | **ثابت وقت تحميل الوحدة** 46px تقريباً | — | — |
| نسبة صورة المنتج | 0.78 (height/width) | نفسها | 0.78 ✓ | 0.78 ✓ |
| عرض السطح الأقصى | 480 | 480 | 480 ✓ | 480 ✓ |

**الخطر الحقيقي:** `SEARCH_BAR_H` في styles.home (index.tsx سطر 818/825) ثابت وقت تحميل الوحدة — لا يتفاعل مع تغيّر النافذة ولا مع fontScale الحقيقي. القيم المتغيرة فعلياً تأتي من `layout.searchHeight` — يوجد **مصدران** للارتفاع نفسه.

### القرار (توحيد)
- القيمة المرجعية **المعتمدة بصرياً** = حبة البحث في v8.9.28+ = **44dp عند 393dp** → المعادلة المعتمدة: `searchHeight = clamp(42, round(widthFactor * 44), 48)`.
- `constants/responsive.ts` يبقى جسراً فقط: `getSearchBarH` و`SEARCH_BAR_H` و`SEARCH_BAR_H_BASE` **أعيد تعريفها من مقياس المحرك نفسه** (44) وليس من صيغة 46 قديمة.
- styles في index.tsx التي تستخدم `SEARCH_BAR_H` تُستبدل بالقيمة التفاعلية `layout.searchHeight` (نفس القيمة عند 393dp = 44، فلا تغيير بصري على الجهاز المرجعي).

### العلاقات الموثقة (بدل التعويضات)
| التعويض القديم | العلاقة الجديدة الموثقة |
|---|---|
| `paddingTop: stickyHeight - 8` | `-8dp` = الفجوة المرجعية بين أسفل الحبة وأول قسم (فجوة بيضاء فوق الفئات). موثقة كـ`LIST_TOP_PULL = 8` مع تعليق علاقتها بالمرجع. |
| `paddingBottom: tabBarHeight + smallGap + 14` | `14dp` = فراغ تصميمي فوق شريط التنقل لضمان ظهور آخر بطاقة كاملة (v8.9.30 الموافقة). ثابت تصميمي عمداً — موثق، ليس تعويضاً عشوائياً. |
| `searchContainer marginBottom: 2` | فجوة الحبة→نهاية البنفسجي = 2dp (الموافقة v8.9.28). |

## ProductCard — التقييم
✅ **سليم أساساً**: العرض يُحسب من `usePhoneLayout()` (تفاعلي) `(contentWidth - cardGap)/2` — ليس نصف نافذة الهاتف الأعمى.
- `cardWidth` من `layout.contentWidth` (السطح مقصوص 480) ✓
- `frameRatio = CARD_WIDTH / IMAGE_HEIGHT` (width/height) — **صحيح، لا يُقلب** ✓
- imageHeight = width * clamp(0.68, ratio, 0.88) ✓ متوافق مع المرجع

**التحسين المنفذ (نقطة 5 من المهمة):** الملف كان يحسب عرضه من layout العام. جعلناه يستقبل `containerWidth` اختيارياً من الأب (الحاوية تحدد العرض عند توفره) مع الحفاظ على المسار الحالي افتراضياً — دون تغيير الشكل عند 393dp.

## ProductImage — التقييم
✅ frame محسوب من frameWidth/frameRatio، fallback يحافظ على الأبعاد، recyclingKey موجود.
- `height = round(frameWidth / frameRatio)` — frameRatio = w/h → h = w/ratio ✓ صحيح (لا عكس).

## الهيدر/التنقل — توثيق من يحجز ماذا
| المساحة | من يحجزها | الدليل |
|---|---|---|
| شريط الحالة | SafeAreaView edges=['top'] (خلفية بنفسجية) | index.tsx:454 |
| sticky header | absolute داخل homeSurface + FlatList paddingTop = stickyHeight-8 (المقاس بonLayout) | index.tsx:460,611 |
| شريط التنقل | MeasuredTabBar غير absolute → Navigator يحجز ارتفاعه فعلياً | (tabs)/_layout.tsx:126-133 |
| paddingBottom القائمة | tabBarHeight (المقاس) + smallGap + 14 تصميمي | index.tsx:611 |

→ **شريط التنقل محجوز من Navigator (ليس متراكباً)**: الارتفاع المقاس يُستخدم فقط كمسافة تصميم أسفل القائمة. لم نعد نضيف safeBottom مزدوجاً (الارتفاع المقاس يشمل insets.bottom لأن tabBarStyle height = insets.bottom + 56).

## المتاجر الموثقة (>3 بائعين)
الحالي: `.map` بدون حد — كل البائعين الموثقين يضغطون في صف واحد flex (يتمدد للأسطر التالية عند 4+). المرجع يعرض 3.
**الإصلاح**: تحويل الصف إلى horizontal ScrollView بعرض عنصر ثابت (storeItemWidth) — 3 ظاهرة والبقية بالتمرير (يحافظ على المرجع + لا فقد وصول).

## الخطوط
- Cairo محمّل بالجذر ✓ لكن لا AppText مركزي — أوزان تُحدد يدوياً في كل مكان.
- `normalize()` موجود لكن غير مطبق شاملة. maxFontSizeMultiplier موجود في حقول الرئيسية فقط.
- **لا نوقف allowFontScaling عالمياً ولا نقسم على fontScale** — نضيف AppText يطبق Cairo + maxFontSizeMultiplier=1.35 (نمو محتمل دون انكسار) ونستخدمه في العناصر الأساسية للرئيسية والبطاقة أولاً.

## الأداء (FlatList)
windowSize=2/initialNumToRender=2/maxToRenderPerBatch=2 قيم أداء موجودة — لا نستخدمها لإخفاء صفوف. نبقيها مع removeClippedSubviews (android only) ونقيس الفراغات أثناء التمرير في مصفوفة الاختبار.

## Android6/API23 (النتيجة الأولية)
- RN في القفل: 0.79.3 — minSdk الرسمي **24** (libs.versions.toml) — merged manifest: minSdk=24.
- → **API23/Android6 غير مدعوم رسمياً بهذه البنية.** الحكم النهائي في تقرير التسليم (بعد فحص المكتبات الأصلية). لا خفض إصدارات ضمن إصلاح الواجهة.

## أخطاء Maestro الحالية (تُصلح في Phase 7)
- home.yaml: `assertVisible: "Rechercher..."` — النص الفعلي "Quel produit recherchez-vous ?" → يفشل دائماً.
- لا assertions إلزامية على الشاشات (كلها runFlow when visible + screenshot).
- لا testIDs في الكود إطلاقاً.
## مقارنة المرجع المعتمد (img_ca810213b26e) vs APK v8.9.32 — النتيجة
- **التركيبة التخطيطية مطابقة 1:1**: الهيدر (جرس/سلة/شعار/موقع/قائمة)، حبة البحث (نفس الارتفاع والانزلاق تحت البنفسجي)، فئات 4 بنفس الأحجام والأسماء، Boutiques vérifiées (3 دوائر + شارات زرقاء)، Sponsorisé (3 بطاقات + رابعة مقطوعة عند الحافة ✓)، Nouveautés عمودان بنفس النسب (صورة 0.78، Top، ⭐، المدينة، الشحن، المخزون)، التنقل السفلي بنفس الأيقونات.
- **الفروقات كلها حالة بيانات وليست تخطيطاً**:
  1. القلوب: المرجع = كلا القلبين أزرق (مفضلة مفعلة)؛ APK الجديد بعد pm clear = حالة مفضلة فارغة (أزرق فاتح/رمادي). السبب: حالة المستخدم، وليس شكلاً.
  2. شارة الدبوس البنفسجية على A54 في APK: البذور تحمل isPinned لنفس المنتج — عُرضت في APK ولم تظهر في المرجع لأن قصّة المرجع تُظهر الصورة أعلى فقط. نفس البنية.
- **الخلاصة**: لا يوجد أي فرق تخطيطي عن المرجع المعتمد على 393dp/FR/fs100/scroll0.
