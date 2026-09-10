# 🤖 منهجية العمل الكاملة — Sokchad AI Agent Playbook
# THE COMPLETE METHODOLOGY — how this AI agent works, decides, builds, tests and delivers
# مكتوبة لتُستخدم من أي ذكاء اصطناعي أو مبرمج يعمل على هذا المشروع — بأسلوبي بالكامل

## 0) القواعد الذهبية التي لا تُخترق / IRON RULES
1. **BUILD ≠ DONE** — بناء APK ناجح ليس إنجازاً. الإنجاز = تشغيل حقيقي + اختبار + إثبات بصري + تسليم كامل.
2. **NO CRASH = قاعدة صارمة** — أي تسليم يجب أن يكون FATAL = 0 في 3 دورات تشغيل على المحاكي على الأقل.
3. **NO EVIDENCE = NOT COMPLETE** — كل تسليم يجب أن يحمل: APK + مصدر tar.gz + SHA256 + لقطة/إثبات بصري. النص وحده ليس تسليماً.
4. **بصمة المطابقة** — أي نسخة "مطابقة" تُثبت بـSHA256 وليس بكلام.
5. **لا تخترع نتائج** — لو فشل شيء، قل "فشل" + السبب + البديل. التلفيق أخطر خطأ على الإطلاق.
6. **سجل كل شيء في المستودع** — كل بناء يُدفع فوراً: commit → GitHub main → Release APK → رابط التحميل المباشر.
7. **versionCode يتصاعد دائماً** — أي بناء جديد versionCode أعلى من السابق (وإلا فشل التثبيت فوق القديم).
8. **الرد السريع** — المستخدم يكرر الانتظار: نفّذ أولاً، اشرح باختصار، لا بحث مطوّل بلا أمر.

## 1) دورة العمل الكاملة لكل تسليم / THE FULL DELIVERY LOOP
```
طلب المستخدم
  ↓
(أ) فحص الوضع الحالي: git log، أي فروع جديدة من Codex؟ أي مستند/صورة جديدة؟
  ↓
(ب) فهم المطلوب بدقة: نص المستخدم + الصور المعلقة (علامات حمراء/زرقاء = مواضع التعديل!)
  ↓
(ج) خطة قصيرة (todo) — كل عنصر قابل للتحقق
  ↓
(د) التعديل بالكود — patch دقيق على الملف الصحيح (وليس نسخة قديمة!)
  ↓
(هـ) تحقق: npx tsc --noEmit → عدد أخطاء == الأساس (0) — أي خطأ جديد = إصلاح فوري
  ↓
(و) بناء: ./gradlew assembleRelease (background + انتظار) — BUILD SUCCESSFUL
  ↓
(ز) bump versionCode + versionName قبل كل تسليم
  ↓
(ح) اختبار المحاكي: boot → install → am start → 3 دورات (force-stop/start) → grep FATAL = 0
  ↓
(ط) فحص بعيني: screencap → vision check — كل عنصر مرسوم؟ لا تداخل؟ لا قصّ؟ اللغة الصحيحة؟
  ↓
(ي) التغليف: cp APK → outbox + tar.gz المصدر (بدون node_modules/.gradle/build/.git) + SHA256SUMS
  ↓
(ك) النشر: git add/commit/push → GitHub Release upload → نسخ APK إلى souktchad.shop/dl/app-release.apk
  ↓
(ل) التسليم النهائي: رسالة فيها APK + مصدر + SHA256 + لقطات + جدول "ما نُفّذ" + "ما لم يُختبر" بصدق
```

## 2) التعامل مع المستخدم / USER INTERACTION STYLE
- المستخدم **ليس مبرمجاً** — اشرح بالنتائج لا بالتقنيات. جدول «طلبك → التنفيذ».
- عربي فصيح واضح، إجابة سريعة عند الطلب («جاوبني بسرعة» = بدون أدوات بحث طويلة).
- المستخدم يرسل **صوراً بعلامات حمراء/زرقاء/سماوية** — العلامة هي المهمة: كل خط أحمر = إزالة، دائرة زرقاء = إضافة، سماوي = مساحة مقصودة.
- عند غموض طلب: نفّذ التفسير الأقرب للأدلة (العلامات على الصورة تفوز على النص)، ولا تسأل إلا للضرورة.
- صراحة كاملة: قسماً «ما اختبرته» و«ما لم يختبره» في كل تسليم. لا تعلن «مطابق 100%» قبل الإثبات.
- عند فشل متكرر لنفس النقطة: توقف، اقترح البديل، ولا تكرر نفس المحاولة.

## 3) إدارة النسخ والمستودع / VERSION & REPO CONTROL
- المستودع: sokchad90-debug/SOUKTCHAD.store — main دائماً محدّث بعد كل تسليم.
- Codex/GPT قد يدفع عمله في **فروع** — افحص branches عند كل "يوجد تحديث؟"، ادمجها (merge API أو محلياً)، احذف الفرع بعد الدمج.
- أمان: .env لا يُرفع أبداً؛ التوكن يُنظف من remote config بعد كل push؛ .env.example placeholders فقط.
- Rollback: git revert commit (لا reset hard إلا للضرورة) — ثم versionCode أعلى (وإلا INSTALL_FAILED_VERSION_DOWNGRADE).
- كل rollback يجب أن يُثبت: بصمة APK الجديدة + لقطة الحالة المرجعة.
- Release: نفس release tag يستقبل كل APKات الإصدارات كأصول — الملاحظات تُحدّث.

## 4) البناء / BUILD PROCEDURE
```bash
cd /opt/data/projects/sokchad/android
unset JAVA_HOME; export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./gradlew assembleRelease --console=plain        # 1.5-14 دقيقة حسب التغيير
```
- البناءات الطويلة: background + notify، أو timeout 590s
- فشل البناء: افحص آخر 3 أسطر — غالباً JS bundling (استيراد مكرر/JSX ناقص) وليس gradle
- TS: `npx tsc --noEmit | grep -c "error TS"` — أساس المشروع = 0 بعد تنظيف Codex؛ أي خطأ جديد يجب إصلاحه فوراً قبل البناء

## 5) الاختبار على المحاكي / EMULATOR TESTING
```bash
# بدء: /opt/android-sdk/emulator/emulator -avd hd_phone -no-window -no-audio -no-snapshot -gpu swiftshader_indirect -netfast -no-boot-anim
adb wait-for-device
# انتظار الإقلاع حتى getprop sys.boot_completed = 1
adb install -r app-release.apk          # -r للتثبيت فوق القديم
adb logcat -c                           # نظّف قبل الدورات!
adb shell am start -n com.anonymous.sokchadapp/.MainActivity
# دورة = force-stop ثم start؛ 3 دورات على الأقل
adb logcat -d | grep -c "FATAL EXCEPTION"   # يجب = 0
adb exec-out screencap -p > shot.png         # الإثبات البصري
```
- «System UI isn't responding» على SwiftShader = قيد محاكي معروف وليس عطلاً بالتطبيق — خلفها التطبيق يعمل (وثّقها بصدق ولا تخفها)
- عند 'more than one device/emulator': استخدم `-s emulator-XXXX` أو اقتل الجميع وأعد تشغيل واحداً
- AVDs بطيئة الإقلاع (tablet/large_tall/medium) قد تفشل تحت تحميل المضيف — بدّل لجهاز أخف ووثّق ذلك بصدق
- uiautomator dump للحصول على bounds دقيقة قبل أي tap على أزرار المودالات

## 6) الفحص البصري / VISUAL QA GATE
- بعد كل تعديل UI: لقطة + فحص بعيني (vision) بأسئلة PASS/FAIL محددة لكل عنصر
- قارن بالمرجع (mockup/صورة المستخدم) بنفس العرض ونفس موضع التمرير
- اختبر: FR + AR + شاشة صغيرة (320dp) + خط 160% على كل تسليم UI مهم
- العربية: تحقق من عدم الانعكاس المزدوج، عزل الأسعار LTR، عدم عكس الشعار والصور
- حوارات ANR بالمحاكي: اضغط Wait وتابع — ووثّق إن ظهرت

## 7) التسليم / DELIVERY FORMAT (رسالة التسليم النموذجية)
```
## ✅ v8.X.X — [العنوان]
### 📱 APK:  MEDIA:/path/SOKCHAD_v8.X.X.apk
### 📦 المصدر: MEDIA:/path/SOKCHAD_v8.X.X.tar.gz
### 🔐 SHA256: MEDIA:/path/SHA256SUMS_v8.X.X.txt
### 📸 الإثبات: MEDIA:لقطات...
### جدول: طلبك → التنفيذ
### التحقق: BUILD ✓ | 3 دورات FATAL=0 | فحص بعيني PASS | GitHub commit | روابط
### لم يُختبر: [قائمة صادقة]
```
- التغليف:
```bash
cd /root/openrouter-bot/outbox
cp app-release.apk SOKCHAD_v8.X.X_name.apk
tar -czf SOKCHAD_v8.X.X_name.tar.gz -C /opt/data/projects --exclude='sokchad/node_modules' --exclude='sokchad/android/.gradle' --exclude='sokchad/android/app/build' --exclude='sokchad/android/build' --exclude='sokchad/.git' sokchad
sha256sum ... > SHA256SUMS_v8.X.X.txt
```

## 8) التعامل مع أخطاء شائعة / COMMON PITFALLS (تعلمناها بالدم)
- **INSTALL_FAILED_VERSION_DOWNGRADE**: الجهاز عليه versionCode أعلى → ارفع versionCode (لا تنزل).
- **FlatList numColumns ديناميكي**: لازم `key={numCols}` وإلا كراش Invariant Violation عند تغيير العرض.
- **git revert يرجع كل إصلاحات الـcommit** — إذا كان الـcommit فيه أكثر من إصلاح، أعد تطبيق ما لا تريد فقدانه بعد الrevert وتحقق بـgrep.
- **paddingTop القائمة**: احسبها من stickyHeight المقاس بonLayout — لا أرقام تخمينية ولا عدّ مزدوج لشريط النظام (وإلا تداخل/فراغ).
- **sticky overlap**: عند إضافة عناصر للهيدر، المحتوى يبدأ قبل نهايته → استخدم الارتفاع المقاس فعلياً.
- **صور المنتجات**: contain دائماً داخل إطار بنسبة ثابتة محسوبة من عرض البطاقة — h = w / ratio (احذر عكس العملية!).
- **العدادات**: عند انتهاء المدة أخفِ العداد، لا تترك 0s.
- **الجمع**: pluralization عربي صحيح (منتج واحد/منتجان/22 منتجًا).
- **الألوان**: من constants/theme.ts + designTokens — لا ألوان خارج النظام.
- **emulator ANR dialogs**: اضغط Wait أو تجاهل — لا تخلط بينها وبين كراش التطبيق.

## 9) تحديثات Codex الخارجية / EXTERNAL UPDATES (Codex/GPT)
1. `git fetch` + فحص branches — إن وُجد فرع جديد: اقرأ diffه، ادمجه main، اسحبه محلياً
2. tsc → بناء → اختبار → نشر — نفس الحلقة
3. إن توقف Codex عند «الحد الأقصى» دون push: افحص events/PRs؛ إن لم يوجد شيء مرفوع، نفّذ التحسينات المطلوبة من صوره المرجعية بنفسك وانشرها باسم واضح
4. حذف الفروع بعد الدمج + تنظيف التوكن من remote

## 10) الوثائق الدائمة / PERSISTENT DOCS
- SOKCHAD_AI_IMAGE_BRIEF.md — brief توليد الصور للفتاة الذكية (هوية/ألوان/بنية/برومبتات)
- SOKCHAD_BUILD_PROMPT.md — برومبت بناء نسخة كاملة للمبرمج (مع دخول تجريبي بائع/مشتري)
- app-screens/ + app-screens.zip — 15 لقطة حقيقية لكل شاشات المشتري
- هذا الملف — منهجية العمل

## 11) الملفات المرجعية للمشروع / KEY FILES
- /opt/data/projects/sokchad — المشروع النشط (git main)
- /root/openrouter-bot/outbox — كل التسليمات (APK + tar.gz + SHA256 + لقطات)
- /var/www/sokchad/dl/app-release.apk — رابط التحميل المباشر (souktchad.shop)
- GitHub Release v8.0-golden — كل APKات الإصدارات
- assets/branding/sokchad-logo-white.png — الشعار الأبيض الرسمي (S + ورقة نعناعية)
- constants/theme.ts + ui/responsive.ts — الألوان والمقاسات الموحدة

## 12) أسلوب النجاح باختصار / SUCCESS FORMULA
> افهم بدقة من العلامات → عدّل في المكوّن المشترك → تحقق TS → ابنِ → اختبر 3 دورات FATAL=0 → فحص بعيني → غلّف → ارفع لكل مكان → سلم بأدلة → وثّق ما لم تختبره بصدق.
> وكررها بسرعة، بلا انتظار، بلا وعود — نتائج فقط.
