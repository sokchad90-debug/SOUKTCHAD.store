import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { borderRadius } from '@/constants/theme';
import { scale } from '@/constants/responsive';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, language } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const sections = [
    {
      icon: 'info' as const,
      title: lb('About Sokchad', 'À propos de Sokchad', 'حول سوق تشاد'),
      body: lb(
        'Sokchad is a peer-to-peer (P2P) classifieds platform that connects buyers and sellers in Chad and Central Africa. Sokchad acts solely as an intermediary to facilitate communication between users. Sokchad does NOT process, handle, or guarantee any financial transactions between users.',
        'Sokchad est une plateforme de petites annonces pair-a-pair (P2P) qui connecte acheteurs et vendeurs au Tchad et en Afrique centrale. Sokchad agit uniquement en tant qu intermediaire pour faciliter la communication entre utilisateurs. Sokchad NE traite PAS, ne gere pas et ne garantit aucune transaction financiere entre utilisateurs.',
        'سوق تشاد هي منصة إعلانات مبوبة من شخص لشخص (P2P) تربط المشترين والبائعين في تشاد وأفريقيا الوسطى. سوق تشاد تعمل فقط كوسيط لتسهيل التواصل بين المستخدمين. سوق تشاد لا تعالج أو تدير أو تضمن أي معاملات مالية بين المستخدمين.'
      ),
    },
    {
      icon: 'gavel' as const,
      title: lb('Limitation of Liability', 'Limitation de responsabilité', 'حدود المسؤولية'),
      body: lb(
        'Sokchad is NOT liable for any disputes, losses, damages, or fraudulent activities that may arise from transactions conducted between users outside the platform. All payments are made directly between buyers and sellers using external payment methods (mobile money, bank transfer, cash, etc.). Users agree to transact at their own risk.',
        "Sokchad n'est pas responsable des litiges, pertes, dommages ou activités frauduleuses pouvant résulter de transactions effectuées entre utilisateurs en dehors de la plateforme. Tous les paiements sont effectués directement entre acheteurs et vendeurs via des moyens de paiement externes (mobile money, virement bancaire, espèces, etc.). Les utilisateurs acceptent de réaliser des transactions à leurs propres risques.",
        'سوق تشاد ليست مسؤولة عن أي نزاعات أو خسائر أو أضرار أو أنشطة احتيالية قد تنشأ عن المعاملات التي تتم بين المستخدمين خارج المنصة. جميع المدفوعات تتم مباشرة بين المشترين والبائعين باستخدام وسائل دفع خارجية (أموال الهاتف المحمول، التحويل البنكي، النقد، إلخ). يوافق المستخدمون على إجراء المعاملات على مسؤوليتهم الخاصة.'
      ),
    },
    {
      icon: 'security' as const,
      title: lb('User Data & Privacy', 'Données utilisateur et confidentialité', 'بيانات المستخدم والخصوصية'),
      body: lb(
        'We collect only the information necessary to provide our services: name, email, phone number, and profile photo. Your data is stored securely and is never sold to third parties. Buyer activity, purchase history, and profile details are kept private and are not visible to other users or sellers. We use industry-standard encryption to protect your information.',
        "Nous collectons uniquement les informations nécessaires à la fourniture de nos services : nom, e-mail, numéro de téléphone et photo de profil. Vos données sont stockées en toute sécurité et ne sont jamais vendues à des tiers. L'activité des acheteurs, l'historique des achats et les détails du profil sont privés et ne sont pas visibles par les autres utilisateurs ou vendeurs. Nous utilisons un chiffrement aux normes industrielles pour protéger vos informations.",
        'نجمع فقط المعلومات الضرورية لتقديم خدماتنا: الاسم والبريد الإلكتروني ورقم الهاتف وصورة الملف الشخصي. يتم تخزين بياناتك بشكل آمن ولا يتم بيعها لأطراف ثالثة أبداً. نشاط المشترين وسجل الشراء وتفاصيل الملف الشخصي تبقى خاصة وغير مرئية للمستخدمين أو البائعين الآخرين. نستخدم تشفيراً بمعايير صناعية لحماية معلوماتك.'
      ),
    },
    {
      icon: 'verified-user' as const,
      title: lb('Verification & Trust', 'Vérification et confiance', 'التوثيق والثقة'),
      body: lb(
        'Sokchad offers optional paid verification (Blue Badge) to help build trust between users. Verification does not guarantee the quality of transactions. Verified users have demonstrated commitment to the platform but are still subject to the same terms. Sokchad reserves the right to revoke verification and ban users who violate platform rules.',
        "Sokchad propose une vérification payante optionnelle (Badge Bleu) pour aider à établir la confiance entre utilisateurs. La vérification ne garantit pas la qualité des transactions. Les utilisateurs vérifiés ont démontré leur engagement envers la plateforme mais restent soumis aux mêmes conditions. Sokchad se réserve le droit de révoquer la vérification et de bannir les utilisateurs qui enfreignent les règles.",
        'تقدم سوق تشاد توثيقاً مدفوعاً اختيارياً (الشارة الزرقاء) للمساعدة في بناء الثقة بين المستخدمين. التوثيق لا يضمن جودة المعاملات. المستخدمون الموثقون أظهروا التزامهم بالمنصة لكنهم يخضعون لنفس الشروط. تحتفظ سوق تشاد بالحق في إلغاء التوثيق وحظر المستخدمين الذين ينتهكون قواعد المنصة.'
      ),
    },
    {
      icon: 'chat' as const,
      title: lb('Communication & Chat', 'Communication et chat', 'التواصل والمحادثات'),
      body: lb(
        'In-app messaging is provided to facilitate communication between buyers and sellers. Sokchad may monitor messages for safety purposes and to detect fraud or abuse. Users must not share personal banking details, passwords, or sensitive information via chat. Any agreements made in chat are between the users involved.',
        "La messagerie intégrée est fournie pour faciliter la communication entre acheteurs et vendeurs. Sokchad peut surveiller les messages à des fins de sécurité et pour détecter la fraude ou les abus. Les utilisateurs ne doivent pas partager de coordonnées bancaires, mots de passe ou informations sensibles via le chat. Tout accord conclu dans le chat est entre les utilisateurs concernés.",
        'يتم توفير المراسلة داخل التطبيق لتسهيل التواصل بين المشترين والبائعين. قد تراقب سوق تشاد الرسائل لأغراض السلامة والكشف عن الاحتيال أو الإساءة. يجب على المستخدمين عدم مشاركة التفاصيل المصرفية أو كلمات المرور أو المعلومات الحساسة عبر المحادثة. أي اتفاقيات تتم في المحادثة هي بين المستخدمين المعنيين.'
      ),
    },
    {
      icon: 'block' as const,
      title: lb('Prohibited Content', 'Contenu interdit', 'المحتوى المحظور'),
      body: lb(
        'Users may not list illegal items, counterfeit goods, weapons, drugs, stolen property, or any content that violates local laws. Sokchad reserves the right to remove any listing and permanently ban users who post prohibited content without prior notice.',
        "Les utilisateurs ne peuvent pas publier des articles illégaux, des contrefaçons, des armes, des drogues, des biens volés ou tout contenu violant les lois locales. Sokchad se réserve le droit de supprimer toute annonce et de bannir définitivement les utilisateurs qui publient du contenu interdit sans préavis.",
        'لا يجوز للمستخدمين إدراج العناصر غير القانونية أو السلع المقلدة أو الأسلحة أو المخدرات أو الممتلكات المسروقة أو أي محتوى ينتهك القوانين المحلية. تحتفظ سوق تشاد بالحق في إزالة أي إعلان وحظر المستخدمين الذين ينشرون محتوى محظوراً بشكل دائم دون إشعار مسبق.'
      ),
    },
    {
      icon: 'child-care' as const,
      title: lb('Age Requirement', "Condition d'âge", 'شرط العمر'),
      body: lb(
        'Users must be at least 18 years old to register and use Sokchad. By creating an account, you confirm that you meet this age requirement. Sokchad is not responsible for minors who access the platform without authorization.',
        "Les utilisateurs doivent avoir au moins 18 ans pour s'inscrire et utiliser Sokchad. En créant un compte, vous confirmez que vous remplissez cette condition d'âge. Sokchad n'est pas responsable des mineurs qui accèdent à la plateforme sans autorisation.",
        'يجب أن يكون عمر المستخدمين 18 عاماً على الأقل للتسجيل واستخدام سوق تشاد. بإنشاء حساب، فإنك تؤكد أنك تستوفي شرط العمر هذا. سوق تشاد ليست مسؤولة عن القاصرين الذين يصلون إلى المنصة بدون إذن.'
      ),
    },
    {
      icon: 'update' as const,
      title: lb('Changes to Terms', 'Modifications des conditions', 'تغييرات الشروط'),
      body: lb(
        'Sokchad reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms. We recommend reviewing this page periodically.',
        "Sokchad se réserve le droit de mettre à jour ces conditions à tout moment. L'utilisation continue de la plateforme après les modifications constitue l'acceptation des conditions mises à jour. Nous recommandons de consulter cette page périodiquement.",
        'تحتفظ سوق تشاد بالحق في تحديث هذه الشروط في أي وقت. الاستمرار في استخدام المنصة بعد التغييرات يشكل قبولاً للشروط المحدثة. نوصي بمراجعة هذه الصفحة بشكل دوري.'
      ),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Privacy Policy & Terms', 'Politique de confidentialité', 'سياسة الخصوصية والشروط')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: scale(16), paddingTop: scale(16), paddingBottom: insets.bottom + scale(32) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <MaterialIcons name="shield" size={scale(40)} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.primary }]}>Sokchad</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {lb(
              'Peer-to-Peer Marketplace for Chad & Central Africa',
              'Marche pair-a-pair pour le Tchad et l Afrique centrale',
              'سوق من شخص لشخص لتشاد وأفريقيا الوسطى'
            )}
          </Text>
        </View>

        {/* Key Disclaimer */}
        <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '40' }]}>
          <MaterialIcons name="warning" size={scale(20)} color={colors.warning} />
          <Text style={[styles.disclaimerText, { color: colors.textPrimary }]}>
            {lb(
              'Sokchad is a P2P intermediary only. We do NOT handle payments and are NOT liable for external transactions between users.',
              'Sokchad est uniquement un intermediaire P2P. Nous NE gerons PAS les paiements et NE sommes PAS responsables des transactions externes entre utilisateurs.',
              'سوق تشاد وسيط P2P فقط. نحن لا ندير المدفوعات ولسنا مسؤولين عن المعاملات الخارجية بين المستخدمين.'
            )}
          </Text>
        </View>

        {/* Sections */}
        {sections.map((section, idx) => (
          <View key={idx} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name={section.icon} size={scale(20)} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{section.title}</Text>
            </View>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        {/* Contact */}
        <View style={[styles.contactCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '25' }]}>
          <MaterialIcons name="email" size={scale(20)} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>
              {lb('Contact Us', 'Nous contacter', 'اتصل بنا')}
            </Text>
            <Text style={[styles.contactEmail, { color: colors.primary }]}>contact@sokchad.com</Text>
          </View>
        </View>

        <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
          {lb('Last updated: February 2026', 'Dernière mise à jour: février 2026', 'آخر تحديث: فبراير 2026')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(16), paddingVertical: scale(14), borderBottomWidth: 1,
  },
  headerTitle: { fontSize: scale(17), fontWeight: '700', flex: 1, textAlign: 'center' },
  heroBanner: {
    alignItems: 'center', padding: scale(24), borderRadius: scale(16), borderWidth: 1, marginBottom: scale(16), gap: scale(6),
  },
  heroTitle: { fontSize: scale(28), fontWeight: '800', marginTop: scale(4) },
  heroSubtitle: { fontSize: scale(13), textAlign: 'center', lineHeight: 19 },
  disclaimerBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), padding: scale(14),
    borderRadius: borderRadius.md, borderWidth: 1.5, marginBottom: scale(16),
  },
  disclaimerText: { flex: 1, fontSize: scale(13), fontWeight: '600', lineHeight: 20 },
  sectionCard: {
    borderRadius: borderRadius.md, borderWidth: 1, padding: scale(16), marginBottom: scale(12), gap: scale(10),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  sectionIconWrap: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: scale(16), fontWeight: '700', flex: 1 },
  sectionBody: { fontSize: scale(14), lineHeight: 22 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(16),
    borderRadius: borderRadius.md, borderWidth: 1, marginTop: scale(4), marginBottom: scale(12),
  },
  contactTitle: { fontSize: scale(14), fontWeight: '600' },
  contactEmail: { fontSize: scale(16), fontWeight: '700', marginTop: scale(2) },
  lastUpdated: { fontSize: scale(12), textAlign: 'center', marginTop: scale(4), marginBottom: scale(16) },
});
