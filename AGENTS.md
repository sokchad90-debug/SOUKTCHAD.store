# Sokchad — إرشادات الوكيل الدائمة

## المهارة الإلزامية: mobile-design
- **المسار**: `.agents/skills/mobile-design/SKILL.md` (مثبتة من github.com/RubenGlez/mobile-design عبر npx skills، مُسلسلة إلى `.hermes/skills/mobile-design`، وموثوقة عبر `hermes skills trust`)
- **القاعدة**: عند أي مهمة واجهة (شاشة/مكون/مراجعة/تصميم) في هذا المشروع: اقرأ SKILL.md أولًا ثم حمّل المراجع المرتبطة فقط (references/design-process.md للمراجعة، screen-patterns.md للشاشات، forms.md للنماذج، react-native-implementation.md للكود، review-checklists.md لضمان الجودة، adaptivity-localization.md للـRTL والترجمة، platform-android.md لأندرويد).
- **القيود الصلبة**: هدف لمس ≥48dp، تباين WCAG AA، مسافات آمنة، دعم RTL للعربية والفرنسية، نصوص داخل `<Text>`، حالات التحميل/الفراغ/الخطأ جزء من التصميم.
- **الهوية الملزمة (لا تتجاوزها)**: الشعار، البنفسجي #5B48D9، الخلفية الفاتحة #F1F0FB، ترتيب الأقسام والوظائف — التحسين في التفاصيل والتناسق فقط، بلا إعادة تصميم من الصفر.
- **قاعدة الاستخدام**: التحسينات على دفعات صغيرة قابلة للتراجع، بدءًا بالمكونات المشتركة. لا إعادة تدقيق التطبيق كاملًا عند تعديل بسيط — استخدم المراجع المرتبطة بالمهمة فقط.

## بيئة المشروع
- React Native/Expo — افحص `package.json` قبل أي نصيحة إصدارات.
- قاعدة إلزامية تاريخية: لا strings خام خارج `<Text>` في JSX (سبب كراش)؛ كل التصريحات فوق early returns.