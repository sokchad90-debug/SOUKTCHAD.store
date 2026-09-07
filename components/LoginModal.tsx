import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Modal, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { borderRadius } from '@/constants/theme';
import { notifySuccess, notifyError, selection } from '@/services/haptics';
import { resetPassword } from '../services/supabaseAuth';
import { signInWithPhp, signUpWithPhp } from '../services/api';
import { supabase } from '../lib/supabase';
import { scale } from '@/constants/responsive';

interface LoginModalProps {
  visible?: boolean;
  isVisible?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'login' | 'signup_choose' | 'signup_form' | 'forgot_email' | 'forgot_otp' | 'forgot_new_password' | 'forgot_pw_link';
type AccountType = 'buyer' | 'seller';

const CHAD = { code: 'TD', dialCode: '+235', flag: '\u{1F1F9}\u{1F1E9}', phoneLength: 8 };

export default function LoginModal({ visible, isVisible, onClose, onSuccess }: LoginModalProps) {
  const isOpen = visible ?? isVisible ?? false;
  const router = useRouter();
  const { colors, language, isUsernameTaken, refreshUserProfile, loadDemoUser } = useApp();
  const {
    sendOTP,
    verifyOTPAndLogin,
    operationLoading,
  } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('login');
  const [accountType, setAccountType] = useState<AccountType>('buyer');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // ─── Forgot Password (Supabase reset link) state ───
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  // ─── Google OAuth error ───
  const [googleError, setGoogleError] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';

  const label = useCallback((en: string, fr: string, ar: string) => {
    if (isFr) return fr;
    if (isAr) return ar;
    return en;
  }, [isFr, isAr]);

  const reset = useCallback(() => {
    setStep('login');
    setAccountType('buyer');
    setName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setError('');
    setUsernameError('');
    setConsentChecked(false);
    setOtpCode('');
    setOtpError('');
    setLocalLoading(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
  }, []);

  const handleClose = useCallback(() => {
    // Prevent closing while a request is in-flight (avoids duplicate requests)
    if (operationLoading || localLoading) return;
    onClose();
    reset();
  }, [onClose, reset, operationLoading, localLoading]);

  // ─── Validation helpers ───

  const isValidEmail = useCallback((val: string): boolean => {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val.trim());
  }, []);

  const isValidName = useCallback((text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;
    const letters = trimmed.replace(/[^a-zA-ZàâéèêëïîôùûüÿæœçÀÂÉÈÊËÏÎÔÙÛÜŸÆŒÇ\u0600-\u06FF]/g, '');
    if (letters.length < 2) return false;
    const uniqueLetters = new Set(letters.toLowerCase());
    if (uniqueLetters.size < 2) return false;
    return true;
  }, []);

  const isRandomGibberish = useCallback((text: string): boolean => {
    const cleaned = text.replace(/[\s\-_.']/g, '');
    if (cleaned.length < 3) return false;
    const lowerCleaned = cleaned.toLowerCase();
    const uniqueChars = new Set(lowerCleaned).size;
    if (uniqueChars === 1 && cleaned.length >= 3) return true;
    if (uniqueChars <= 2 && cleaned.length >= 4) return true;
    if (uniqueChars <= 3 && cleaned.length >= 6) return true;
    if (/(.)\1{2,}/i.test(cleaned)) return true;
    if (cleaned.length >= 6) {
      let repeatPairs = 0;
      for (let i = 0; i < lowerCleaned.length - 3; i++) {
        if (lowerCleaned[i] === lowerCleaned[i + 2] && lowerCleaned[i + 1] === lowerCleaned[i + 3]) repeatPairs++;
      }
      if (repeatPairs >= 2) return true;
    }
    const vowelRatio = (cleaned.match(/[aeiouAEIOUàâéèêëïîôùûüÿæœ]/g) || []).length / cleaned.length;
    if (vowelRatio < 0.08 && cleaned.length > 5) return true;
    const digitRatio = (cleaned.match(/[0-9]/g) || []).length / cleaned.length;
    if (digitRatio > 0.5 && cleaned.length > 6) return true;
    if (/[^aeiouAEIOUàâéèêëïîôùûüÿæœ0-9\s]{5,}/i.test(cleaned)) return true;
    if (cleaned.length >= 8 && uniqueChars <= Math.ceil(cleaned.length * 0.3)) return true;
    return false;
  }, []);

  const handleUsernameChange = useCallback((text: string) => {
    const trimmed = text.slice(0, 30);
    setUsername(trimmed);
    if (trimmed.trim().length > 0) {
      if (isUsernameTaken(trimmed)) {
        setUsernameError(label('This name is already taken.', 'Ce nom est déjà pris.', 'هذا الاسم مأخوذ بالفعل.'));
      } else if (isRandomGibberish(trimmed)) {
        setUsernameError(label('Please enter a readable name, not random characters.', 'Veuillez entrer un nom lisible.', 'يرجى إدخال اسم مقروء وليس أحرف عشوائية.'));
      } else {
        setUsernameError('');
      }
    } else {
      setUsernameError('');
    }
  }, [isUsernameTaken, isRandomGibberish, label]);

  // ─── Real Auth Handlers ───

  // Demo login — bypasses Supabase and logs in with a pre-built profile
  const handleDemoLogin = useCallback(async (type: 'seller' | 'buyer') => {
    setLocalLoading(true);
    try {
      const demoUser = type === 'seller'
        ? {
            id: 'demo-seller-001',
            numericId: 'Sok-12345',
            name: 'Demo Seller',
            username: 'demo_seller',
            email: 'seller@sokchad.demo',
            phone: '+235 66 12 34 56',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
            coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=300&fit=crop',
            role: 'seller' as const,
            isSeller: true,
            sellerId: 'Sok-12345',
            isVerified: true,
            isVerifiedBuyer: false,
            isBanned: false,
            completedPurchases: 0,
            paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 12 34 56' }, { methodId: 'moov', receivingNumber: '99 78 90 12' }],
          }
        : {
            id: 'demo-buyer-001',
            numericId: 'Sok-67890',
            name: 'Demo Buyer',
            username: 'demo_buyer',
            email: 'buyer@sokchad.demo',
            phone: '+235 99 87 65 43',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
            coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=300&fit=crop',
            role: 'buyer' as const,
            isSeller: false,
            isVerified: false,
            isVerifiedBuyer: false,
            isBanned: false,
            completedPurchases: 5,
            paymentMethods: [],
          };

      // Save to AsyncStorage so it persists across restarts
      await AsyncStorage.setItem("sokchad_user", JSON.stringify(demoUser));
      await loadDemoUser();
      // Call onSuccess to close modal — the AppContext will pick it up
      if (onSuccess) onSuccess();
      else handleClose();
    } catch (e) {
      console.warn('Demo login error:', e);
    } finally {
      setLocalLoading(false);
    }
  }, [onSuccess, handleClose]);

  const handleLogin = useCallback(async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError(label('Please fill all fields.', 'Veuillez remplir tous les champs.', 'يرجى ملء جميع الحقول.'));
      return;
    }
    if (!isValidEmail(email)) {
      setError(label('Please enter a valid email (e.g. name@example.com).', 'Veuillez entrer un e-mail valide (ex: nom@exemple.com).', 'يرجى إدخال بريد إلكتروني صالح.'));
      return;
    }

    setLocalLoading(true);
    try {
      const result = await signInWithPhp(email.trim(), password);
      setLocalLoading(false);

      if (!result.success || !result.user) {
        notifyError();
        setError(result.error || 'Login failed');
        return;
      }

      notifySuccess();
      reset();

      // CRITICAL: Load the user into AppContext immediately after PHP login.
      // signInWithPhp saves to AsyncStorage but doesn't call setUser in AppContext.
      // Without this, isSeller stays false and the seller sees wrong tabs / spinner.
      await loadDemoUser();

      // Check if admin
      const role = result.user?.role;
      if (role === 'admin' || role === 'super_admin') {
        onClose();
        router.replace('/admin/dashboard');
        return;
      }

      if (onSuccess) onSuccess();
      else onClose();
    } catch (e) {
      setLocalLoading(false);
      notifyError();
      setError(label('Connection error', 'Erreur de connexion', 'خطأ في الاتصال'));
    }
  }, [email, password, reset, onClose, onSuccess, router, label, isValidEmail]);

  // ─── Forgot Password (Supabase reset link) handler ───
  const handleForgotPassword = useCallback(async () => {
    setError('');
    if (!forgotEmail.trim()) {
      setError(label('Please enter your email.', 'Veuillez entrer votre e-mail.', 'يرجى إدخال بريدك الإلكتروني.'));
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setError(label('Please enter a valid email.', 'Veuillez entrer un e-mail valide.', 'يرجى إدخال بريد إلكتروني صالح.'));
      return;
    }
    setForgotLoading(true);
    try {
      const result = await resetPassword(forgotEmail.trim());
      setForgotLoading(false);
      if (!result.success) {
        setError(result.error || label('Failed to send reset link.', 'Échec de l\'envoi du lien.', 'فشل إرسال الرابط.'));
        return;
      }
      setForgotSent(true);
      notifySuccess();
    } catch (e) {
      setForgotLoading(false);
      notifyError();
      setError(label('Connection error', 'Erreur de connexion', 'خطأ في الاتصال'));
    }
  }, [forgotEmail, label, isValidEmail]);

  // ─── Google OAuth handler ───
  const handleGoogleSignIn = useCallback(async () => {
    setGoogleError('');
    setLocalLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      setLocalLoading(false);
      if (oauthError) {
        setGoogleError(oauthError.message || label('Google sign-in failed.', 'Échec de la connexion Google.', 'فشل تسجيل الدخول عبر Google.'));
        notifyError();
      }
    } catch (e: any) {
      setLocalLoading(false);
      setGoogleError(label('Google sign-in failed.', 'Échec de la connexion Google.', 'فشل تسجيل الدخول عبر Google.'));
      notifyError();
    }
  }, [label]);

  // Validate signup and send real OTP
  const handleSignupValidation = useCallback(async () => {
    setError('');
    if (!name.trim() || !username.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError(label('Please fill all fields.', 'Veuillez remplir tous les champs.', 'يرجى ملء جميع الحقول.'));
      return;
    }
    if (!isValidName(name)) {
      setError(label('Please enter a real name (min 3 characters).', 'Veuillez entrer un vrai nom (min 3 caractères).', 'يرجى إدخال اسم حقيقي (3 أحرف على الأقل).'));
      return;
    }
    if (isRandomGibberish(name.trim())) {
      setError(label('Please enter a real name, not random characters.', 'Veuillez entrer un vrai nom.', 'يرجى إدخال اسم حقيقي.'));
      return;
    }
    if (!isValidEmail(email)) {
      setError(label('Please enter a valid email (e.g. name@example.com).', 'Veuillez entrer un e-mail valide.', 'يرجى إدخال بريد إلكتروني صالح.'));
      return;
    }
    const digitsOnly = phone.replace(/[^0-9]/g, '');
    if (digitsOnly.length !== CHAD.phoneLength) {
      setError(label(`Phone number must be exactly ${CHAD.phoneLength} digits.`, `Le numéro doit contenir exactement ${CHAD.phoneLength} chiffres.`, `يجب أن يتكون رقم الهاتف من ${CHAD.phoneLength} أرقام بالضبط.`));
      return;
    }
    if (username.trim().length > 30) {
      setError(label('Username must be 30 characters or less.', 'Le nom ne doit pas dépasser 30 caractères.', 'يجب ألا يتجاوز الاسم 30 حرفاً.'));
      return;
    }
    if (isRandomGibberish(username.trim())) {
      setError(label('Please enter a readable username.', 'Veuillez entrer un nom lisible.', 'يرجى إدخال اسم مقروء.'));
      return;
    }
    if (password.length < 6) {
      setError(label('Password must be at least 6 characters.', 'Le mot de passe doit contenir au moins 6 caractères.', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'));
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      setError(label('Password must contain both letters and numbers.', 'Le mot de passe doit contenir des lettres et des chiffres.', 'يجب أن تحتوي كلمة المرور على أحرف وأرقام.'));
      return;
    }
    if (!consentChecked) {
      setError(label('You must confirm you are over 18 and agree to the Privacy Policy.', 'Vous devez confirmer que vous avez plus de 18 ans et accepter la politique de confidentialité.', 'يجب أن تؤكد أنك فوق 18 عاماً وتوافق على سياسة الخصوصية.'));
      return;
    }
    if (isUsernameTaken(username)) {
      setError(label('This name is already taken.', 'Ce nom est déjà pris.', 'هذا الاسم مأخوذ بالفعل.'));
      return;
    }

    // Register via PHP API (auth_email.php)
    setLocalLoading(true);
    try {
      const result = await signUpWithPhp({
        email: email.trim(),
        password: password,
        fullName: name.trim(),
        phone: '+235' + digitsOnly,
        role: accountType === 'seller' ? 'seller' : 'buyer',
        username: username.trim(),
      });
      setLocalLoading(false);

      if (!result.success || !result.user) {
        setError(result.error || 'Registration failed');
        return;
      }

      notifySuccess();
      reset();
      if (onSuccess) onSuccess();
      else onClose();
    } catch (e) {
      setLocalLoading(false);
      setError(label('Connection error', 'Erreur de connexion', 'خطأ في الاتصال'));
    }
  }, [name, username, email, phone, password, consentChecked, accountType, isValidName, isRandomGibberish, isValidEmail, isUsernameTaken, label, reset, onClose, onSuccess]);

  const isLoading = localLoading; // Only use localLoading — operationLoading from Supabase is irrelevant for PHP auth

  // ─── Render sections ───

  const usernameLabel = accountType === 'seller'
    ? label('STORE NAME (Unique)', 'NOM DE BOUTIQUE (Unique)', 'اسم المتجر (فريد)')
    : label('USERNAME (Unique)', "NOM D'UTILISATEUR (Unique)", 'اسم المستخدم (فريد)');

  const usernamePlaceholder = accountType === 'seller'
    ? label('Enter your store name', 'Entrez le nom de votre boutique', 'أدخل اسم متجرك')
    : label('Enter a username', 'Choisissez un nom', 'اختر اسم مستخدم');

  // Inline validation flags for the signup form (used to show field-level errors)
  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);
  const phoneInvalid = phone.length > 0 && phone.length !== CHAD.phoneLength;
  const passwordTooShort = password.length > 0 && password.length < 6;
  const passwordWeak = password.length >= 6 && !((/[a-zA-Z]/.test(password)) && (/[0-9]/.test(password)));
  const nameInvalid = name.trim().length > 0 && !isValidName(name);

  // Continue button is disabled until everything is valid AND consent is checked
  const signupFormValid =
    isValidName(name) &&
    !isRandomGibberish(name.trim()) &&
    username.trim().length > 0 &&
    !usernameError &&
    !isUsernameTaken(username) &&
    isValidEmail(email) &&
    phone.replace(/[^0-9]/g, '').length === CHAD.phoneLength &&
    password.length >= 6 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    consentChecked;

  const openPrivacyPolicy = useCallback(() => {
    Keyboard.dismiss();
    // Cast to keep consistent with the rest of the codebase (typed-router config
    // doesn't include the privacy-policy route in its generated union).
    router.push('/privacy-policy' as any);
  }, [router]);

  // Reusable password input with the eye icon inside (right side)
  const PasswordField = useCallback(({
    value,
    onChangeText,
    placeholder,
    showState,
    setShowState,
    editable,
  }: {
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    showState: boolean;
    setShowState: (updater: (p: boolean) => boolean) => void;
    editable?: boolean;
  }) => (
    <View style={styles.passwordWrap}>
      <TextInput
        style={[styles.input, styles.passwordInputInner, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showState}
        editable={editable}
      />
      <Pressable
        onPress={() => setShowState(p => !p)}
        hitSlop={10}
        style={styles.eyeInside}
      >
        <MaterialIcons name={showState ? 'visibility-off' : 'visibility'} size={scale(20)} color={colors.textTertiary} />
      </Pressable>
    </View>
  ), [colors.backgroundSecondary, colors.textPrimary, colors.border, colors.textTertiary]);

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={Keyboard.dismiss}>
          <Pressable
            style={[styles.modal, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, scale(16)) }]}
            onStartShouldSetResponder={() => false}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.grabHandle, { backgroundColor: colors.border }]} />
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <MaterialIcons name="close" size={scale(22)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.scrollContent, { paddingBottom: scale(24) + Math.max(insets.bottom, 0) }]}
            >
              {/* ═══ LOGIN ═══ */}
              {step === 'login' ? (
                <>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {label('Welcome Back', 'Bienvenue', 'مرحباً بعودتك')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {label('Log in to your account', 'Connectez-vous à votre compte', 'سجل الدخول إلى حسابك')}
                  </Text>

                  {error ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                      <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {label('EMAIL', 'E-MAIL', 'البريد الإلكتروني')}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder={label('Enter your email', 'Entrez votre e-mail', 'أدخل بريدك الإلكتروني')}
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  {emailInvalid ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Enter a valid email', 'E-mail invalide', 'بريد غير صالح')}
                    </Text>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {label('PASSWORD', 'MOT DE PASSE', 'كلمة المرور')}
                  </Text>
                  <PasswordField
                    value={password}
                    onChangeText={setPassword}
                    placeholder="* * * * * *"
                    showState={showPassword}
                    setShowState={setShowPassword}
                    editable={!isLoading}
                  />

                  <Pressable
                    onPress={() => { setStep('forgot_pw_link'); setError(''); setForgotSent(false); }}
                    style={styles.forgotBtn}
                    hitSlop={8}
                  >
                    <Text style={[styles.forgotText, { color: colors.primary }]}>
                      {label('Forgot Password?', 'Mot de passe oublié ?', 'نسيت كلمة المرور؟')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleLogin}
                    disabled={isLoading}
                    style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.5 : pressed ? 0.85 : 1 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{label('Log In', 'Connexion', 'تسجيل الدخول')}</Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => { setStep('signup_choose'); setError(''); }} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label("Don't have an account?", 'Pas encore de compte?', 'ليس لديك حساب؟')}{' '}
                    </Text>
                    <Text style={[styles.toggleLink, { color: colors.primary }]}>
                      {label('Sign Up', "S'inscrire", 'إنشاء حساب')}
                    </Text>
                  </Pressable>

                  {/* Instant Demo Login — prominent one-tap buttons */}
                  <View style={[styles.demoSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.demoTitle, { color: colors.textTertiary }]}>
                      {label('Instant Demo Access', 'Accès démo instantané', 'دخول تجريبي فوري')}
                    </Text>
                    <Text style={[{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 4 } as any, { color: colors.textTertiary }]}>
                      {label('Tap to explore the app instantly', "Touchez pour explorer l'app", 'اضغط لاستكشاف التطبيق فوراً')}
                    </Text>
                    <View style={styles.demoBtnRow}>
                      <Pressable
                        onPress={() => handleDemoLogin('seller')}
                        style={({ pressed }) => [styles.demoBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                      >
                        <MaterialIcons name="storefront" size={scale(22)} color="#FFF" />
                        <Text style={[styles.demoBtnText, { color: '#FFF' }]}>
                          {label('Seller', 'Vendeur', 'بائع')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDemoLogin('buyer')}
                        style={({ pressed }) => [styles.demoBtn, { backgroundColor: colors.secondary, borderColor: colors.secondary, opacity: pressed ? 0.85 : 1 }]}
                      >
                        <MaterialIcons name="shopping-bag" size={scale(22)} color="#FFF" />
                        <Text style={[styles.demoBtnText, { color: '#FFF' }]}>
                          {label('Buyer', 'Acheteur', 'مشتري')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : null}

              {/* ═══ CHOOSE ACCOUNT TYPE ═══ */}
              {step === 'signup_choose' ? (
                <>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {label('Create Account', 'Créer un compte', 'إنشاء حساب')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {label('Choose how you want to use Sokchad', 'Choisissez comment utiliser Sokchad', 'اختر كيف تريد استخدام سوق تشاد')}
                  </Text>

                  <Pressable
                    onPress={() => { setAccountType('buyer'); setStep('signup_form'); }}
                    style={({ pressed }) => [styles.accountTypeCard, styles.accountTypeCardBuyer, { backgroundColor: colors.surface, borderColor: colors.secondary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  >
                    <View style={[styles.accountIconCircle, { backgroundColor: colors.secondary + '15' }]}>
                      <MaterialIcons name="shopping-bag" size={scale(28)} color={colors.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountTypeTitle, { color: colors.textPrimary }]}>
                        {label('Create Buyer Account', 'Compte Acheteur', 'حساب مشتري')}
                      </Text>
                      <Text style={[styles.accountTypeDesc, { color: colors.textSecondary }]}>
                        {label('Browse, buy, and chat with sellers', 'Parcourir, acheter et discuter', 'تصفح واشتري وتواصل مع البائعين')}
                      </Text>
                    </View>
                    <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(24)} color={colors.secondary} />
                  </Pressable>

                  <Pressable
                    onPress={() => { setAccountType('seller'); setStep('signup_form'); }}
                    style={({ pressed }) => [styles.accountTypeCard, styles.accountTypeCardSeller, { backgroundColor: colors.surface, borderColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  >
                    <View style={[styles.accountIconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <MaterialIcons name="storefront" size={scale(28)} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accountTypeTitle, { color: colors.textPrimary }]}>
                        {label('Create Seller Account', 'Compte Vendeur', 'حساب بائع')}
                      </Text>
                      <Text style={[styles.accountTypeDesc, { color: colors.textSecondary }]}>
                        {label('List products and manage your store', 'Publiez et gérez votre boutique', 'أضف منتجات وأدر متجرك')}
                      </Text>
                    </View>
                    <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(24)} color={colors.primary} />
                  </Pressable>

                  <Pressable onPress={() => { setStep('login'); setError(''); }} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label('Already have an account?', 'Vous avez déjà un compte ?', 'لديك حساب بالفعل؟')}{' '}
                    </Text>
                    <Text style={[styles.toggleLink, { color: colors.primary }]}>
                      {label('Log In', 'Connexion', 'تسجيل الدخول')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* ═══ SIGNUP FORM ═══ */}
              {step === 'signup_form' ? (
                <>
                  <View style={styles.formHeaderRow}>
                    <View style={[styles.accountTypeBadge, { backgroundColor: accountType === 'seller' ? colors.primary + '15' : colors.secondary + '15' }]}>
                      <MaterialIcons name={accountType === 'seller' ? 'storefront' : 'shopping-bag'} size={scale(14)} color={accountType === 'seller' ? colors.primary : colors.secondary} />
                      <Text style={[styles.accountTypeBadgeText, { color: accountType === 'seller' ? colors.primary : colors.secondary }]}>
                        {accountType === 'seller' ? label('Seller', 'Vendeur', 'بائع') : label('Buyer', 'Acheteur', 'مشتري')}
                      </Text>
                    </View>
                    <Pressable onPress={() => { setStep('signup_choose'); setError(''); }} hitSlop={8} style={styles.changeTypeBtn}>
                      <Text style={[styles.changeTypeText, { color: colors.textSecondary }]}>
                        {label('Change', 'Changer', 'تغيير')}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.title, { color: colors.textPrimary, marginTop: 8 }]}>
                    {label('Sign Up', "S'inscrire", 'إنشاء حساب')}
                  </Text>

                  {error ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                      <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: nameInvalid ? colors.error : colors.textSecondary }]}>
                    {label('FULL NAME', 'NOM COMPLET', 'الاسم الكامل')}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.inputCompact, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: nameInvalid ? colors.error : colors.border }]}
                    placeholder={label('Enter your full name', 'Entrez votre nom', 'أدخل اسمك الكامل')}
                    placeholderTextColor={colors.textTertiary}
                    value={name}
                    onChangeText={setName}
                    editable={!isLoading}
                  />
                  {nameInvalid ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Enter a real name (min 3 letters)', 'Nom invalide', 'اسم غير صالح')}
                    </Text>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: usernameError ? colors.error : colors.textSecondary }]}>
                    {usernameLabel}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.inputCompact, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: usernameError ? colors.error : colors.border }]}
                    placeholder={usernamePlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    value={username}
                    onChangeText={handleUsernameChange}
                    maxLength={30}
                    editable={!isLoading}
                  />
                  {usernameError ? (
                    <View style={styles.inlineErrorRow}>
                      <MaterialIcons name="error-outline" size={scale(13)} color={colors.error} />
                      <Text style={[styles.inlineErrorText, { color: colors.error }]}>{usernameError}</Text>
                    </View>
                  ) : username.trim().length > 0 ? (
                    <View style={styles.inlineErrorRow}>
                      <MaterialIcons name="check-circle" size={scale(13)} color={colors.success} />
                      <Text style={[styles.inlineErrorText, { color: colors.success }]}>{label('Available', 'Disponible', 'متاح')}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: emailInvalid ? colors.error : colors.textSecondary }]}>
                    {label('EMAIL', 'E-MAIL', 'البريد الإلكتروني')}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.inputCompact, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: emailInvalid ? colors.error : colors.border }]}
                    placeholder={label('Enter your email', 'Entrez votre e-mail', 'أدخل بريدك الإلكتروني')}
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  {emailInvalid ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Enter a valid email (e.g. name@example.com)', 'E-mail invalide', 'بريد غير صالح')}
                    </Text>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: phoneInvalid ? colors.error : colors.textSecondary }]}>
                    {label('PHONE NUMBER', 'NUMERO DE TELEPHONE', 'رقم الهاتف')}
                  </Text>
                  <View style={styles.phoneRow}>
                    <View style={[styles.countryPrefix, { backgroundColor: colors.secondary + '12', borderColor: colors.secondary + '40' }]}>
                      <Text style={styles.countryFlag}>{CHAD.flag}</Text>
                      <Text style={[styles.countryCode, { color: colors.secondary }]}>{CHAD.dialCode}</Text>
                    </View>
                    <TextInput
                      style={[styles.phoneInput, styles.inputCompact, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: phoneInvalid ? colors.error : colors.border }]}
                      placeholder={'X'.repeat(CHAD.phoneLength)}
                      placeholderTextColor={colors.textTertiary}
                      value={phone}
                      onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={CHAD.phoneLength}
                      editable={!isLoading}
                    />
                  </View>
                  {phoneInvalid ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label(`Chad: exactly ${CHAD.phoneLength} digits`, `Tchad: exactement ${CHAD.phoneLength} chiffres`, `تشاد: ${CHAD.phoneLength} أرقام بالضبط`)}
                    </Text>
                  ) : (
                    <Text style={[styles.phoneHint, { color: colors.textTertiary }]}>
                      {label(`Chad: exactly ${CHAD.phoneLength} digits`, `Tchad: exactement ${CHAD.phoneLength} chiffres`, `تشاد: ${CHAD.phoneLength} أرقام بالضبط`)}
                    </Text>
                  )}

                  <Text style={[styles.fieldLabel, { color: (passwordTooShort || passwordWeak) ? colors.error : colors.textSecondary }]}>
                    {label('PASSWORD', 'MOT DE PASSE', 'كلمة المرور')}
                  </Text>
                  <PasswordField
                    value={password}
                    onChangeText={setPassword}
                    placeholder={label('Letters + Numbers, min 6', 'Lettres + Chiffres, min 6', 'أحرف + أرقام، 6 على الأقل')}
                    showState={showPassword}
                    setShowState={setShowPassword}
                    editable={!isLoading}
                  />
                  {passwordTooShort ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Password must be at least 6 characters.', 'Min 6 caractères.', '6 أحرف على الأقل.')}
                    </Text>
                  ) : passwordWeak ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Password must contain both letters and numbers.', 'Lettres et chiffres requis.', 'أحرف وأرقام مطلوبة.')}
                    </Text>
                  ) : null}

                  {/* Consent row — full row pressable, with pressable links */}
                  <Pressable
                    onPress={() => { selection(); setConsentChecked(p => !p); }}
                    style={styles.consentRow}
                  >
                    <View style={[styles.checkbox, { borderColor: consentChecked ? colors.primary : colors.border, backgroundColor: consentChecked ? colors.primary : 'transparent' }]}>
                      {consentChecked ? <MaterialIcons name="check" size={scale(16)} color="#FFF" /> : null}
                    </View>
                    <View style={styles.consentTextWrap}>
                      <Text style={[styles.consentText, { color: colors.textSecondary }]}>
                        {label('I confirm I am over 18 years old and agree to the ', "Je confirme avoir plus de 18 ans et accepte la ", 'أؤكد أنني فوق 18 عاماً وأوافق على ')}
                      </Text>
                      <Pressable onPress={openPrivacyPolicy} hitSlop={6}>
                        <Text style={[styles.consentLink, { color: colors.primary }]}>
                          {label('Privacy Policy', 'Politique de confidentialité', 'سياسة الخصوصية')}
                        </Text>
                      </Pressable>
                      <Text style={[styles.consentText, { color: colors.textSecondary }]}>
                        {label(' and the ', ' et les ', ' و')}
                      </Text>
                      <Pressable onPress={openPrivacyPolicy} hitSlop={6}>
                        <Text style={[styles.consentLink, { color: colors.primary }]}>
                          {label('Terms of Service', 'conditions', 'شروط الخدمة')}
                        </Text>
                      </Pressable>
                      <Text style={[styles.consentText, { color: colors.textSecondary }]}>.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={handleSignupValidation}
                    disabled={isLoading || !signupFormValid}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: accountType === 'seller' ? colors.primary : colors.secondary, opacity: (isLoading || !signupFormValid) ? 0.5 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {label('Continue', 'Continuer', 'متابعة')}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => { setStep('login'); setError(''); }} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label('Already have an account?', 'Vous avez déjà un compte ?', 'لديك حساب بالفعل؟')}{' '}
                    </Text>
                    <Text style={[styles.toggleLink, { color: colors.primary }]}>
                      {label('Log In', 'Connexion', 'تسجيل الدخول')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* ═══ FORGOT PASSWORD - ENTER EMAIL ═══ */}
              {step === 'forgot_email' ? (
                <>
                  <View style={styles.formHeaderRow}>
                    <Pressable onPress={() => { setStep('login'); setError(''); }} hitSlop={12}>
                      <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
                    </Pressable>
                    <View style={[styles.accountTypeBadge, { backgroundColor: colors.warning + '15' }]}>
                      <MaterialIcons name="lock-reset" size={scale(14)} color={colors.warning} />
                      <Text style={[styles.accountTypeBadgeText, { color: colors.warning }]}>
                        {label('Reset', 'Réinit.', 'إعادة تعيين')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.otpIconWrap}>
                    <View style={[styles.otpIconCircle, { backgroundColor: colors.warning + '12' }]}>
                      <MaterialIcons name="lock-reset" size={scale(48)} color={colors.warning} />
                    </View>
                  </View>

                  <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center' }]}>
                    {label('Reset Password', 'Réinitialiser le mot de passe', 'إعادة تعيين كلمة المرور')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                    {label(
                      'Enter your email address and we will send a verification code to reset your password.',
                      'Entrez votre adresse e-mail et nous vous enverrons un code de vérification.',
                      'أدخل عنوان بريدك الإلكتروني وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور.'
                    )}
                  </Text>

                  {error ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                      <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {label('EMAIL', 'E-MAIL', 'البريد الإلكتروني')}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder={label('Enter your email', 'Entrez votre e-mail', 'أدخل بريدك الإلكتروني')}
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />

                  <Pressable
                    onPress={async () => {
                      setError('');
                      if (!email.trim()) {
                        setError(label('Please enter your email.', 'Veuillez entrer votre e-mail.', 'يرجى إدخال بريدك الإلكتروني.'));
                        return;
                      }
                      if (!isValidEmail(email)) {
                        setError(label('Please enter a valid email.', 'Veuillez entrer un e-mail valide.', 'يرجى إدخال بريد إلكتروني صالح.'));
                        return;
                      }
                      setLocalLoading(true);
                      const otpResult = await sendOTP(email.trim());
                      setLocalLoading(false);
                      if (otpResult.error) {
                        setError(otpResult.error);
                        return;
                      }
                      setOtpCode('');
                      setOtpError('');
                      setStep('forgot_otp');
                    }}
                    disabled={isLoading}
                    style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.warning, opacity: isLoading ? 0.5 : pressed ? 0.85 : 1 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{label('Send Reset Code', 'Envoyer le code', 'إرسال رمز إعادة التعيين')}</Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => { setStep('login'); setError(''); }} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label('Back to Login', 'Retour à la connexion', 'العودة لتسجيل الدخول')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* ═══ FORGOT PASSWORD - SUPABASE RESET LINK ═══ */}
              {step === 'forgot_pw_link' ? (
                <>
                  <View style={styles.formHeaderRow}>
                    <Pressable onPress={() => { setStep('login'); setError(''); setForgotSent(false); setForgotEmail(''); }} hitSlop={12}>
                      <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
                    </Pressable>
                    <View style={[styles.accountTypeBadge, { backgroundColor: colors.warning + '15' }]}>
                      <MaterialIcons name="lock-reset" size={scale(14)} color={colors.warning} />
                      <Text style={[styles.accountTypeBadgeText, { color: colors.warning }]}>
                        {label('Reset', 'Réinit.', 'إعادة تعيين')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.otpIconWrap}>
                    <View style={[styles.otpIconCircle, { backgroundColor: colors.warning + '12' }]}>
                      <MaterialIcons name="lock-reset" size={scale(48)} color={colors.warning} />
                    </View>
                  </View>

                  <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center' }]}>
                    {label('Reset Password', 'Réinitialiser le mot de passe', 'إعادة تعيين كلمة المرور')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                    {label(
                      'Enter your email address and we will send you a link to reset your password.',
                      'Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.',
                      'أدخل عنوان بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.'
                    )}
                  </Text>

                  {forgotSent ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.success + '15' }]}>
                      <MaterialIcons name="check-circle" size={scale(16)} color={colors.success} />
                      <Text style={[styles.errorText, { color: colors.success }]}>
                        {label(
                          'A password reset link has been sent to your e-mail',
                          'Un lien de réinitialisation a été envoyé à votre e-mail',
                          'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني'
                        )}
                      </Text>
                    </View>
                  ) : (
                    <>
                      {error ? (
                        <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                          <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                      ) : null}

                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        {label('EMAIL', 'E-MAIL', 'البريد الإلكتروني')}
                      </Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder={label('Enter your email', 'Entrez votre e-mail', 'أدخل بريدك الإلكتروني')}
                        placeholderTextColor={colors.textTertiary}
                        value={forgotEmail}
                        onChangeText={setForgotEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!forgotLoading}
                      />

                      <Pressable
                        onPress={handleForgotPassword}
                        disabled={forgotLoading}
                        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.warning, opacity: forgotLoading ? 0.5 : pressed ? 0.85 : 1 }]}
                      >
                        {forgotLoading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.primaryBtnText}>{label('Send Reset Link', 'Envoyer le lien', 'إرسال رابط الاستعادة')}</Text>
                        )}
                      </Pressable>
                    </>
                  )}

                  <Pressable onPress={() => { setStep('login'); setError(''); setForgotSent(false); setForgotEmail(''); }} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label('Back to Login', 'Retour à la connexion', 'العودة لتسجيل الدخول')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* ═══ FORGOT PASSWORD - VERIFY OTP ═══ */}
              {step === 'forgot_otp' ? (
                <>
                  <View style={styles.formHeaderRow}>
                    <Pressable onPress={() => { setStep('forgot_email'); setOtpError(''); }} hitSlop={12}>
                      <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
                    </Pressable>
                    <View style={[styles.accountTypeBadge, { backgroundColor: colors.warning + '15' }]}>
                      <MaterialIcons name="verified-user" size={scale(14)} color={colors.warning} />
                      <Text style={[styles.accountTypeBadgeText, { color: colors.warning }]}>
                        {label('Verify', 'Vérifier', 'تحقق')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.otpIconWrap}>
                    <View style={[styles.otpIconCircle, { backgroundColor: colors.warning + '12' }]}>
                      <MaterialIcons name="mark-email-read" size={scale(48)} color={colors.warning} />
                    </View>
                  </View>

                  <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center' }]}>
                    {label('Enter Verification Code', 'Entrez le code', 'أدخل رمز التحقق')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                    {label(
                      `We sent a 4-digit code to ${email.trim()}`,
                      `Nous avons envoyé un code à 4 chiffres à ${email.trim()}`,
                      `أرسلنا رمز مكون من 4 أرقام إلى ${email.trim()}`
                    )}
                  </Text>

                  <View style={[styles.otpHintBox, { backgroundColor: colors.warning + '08', borderColor: colors.warning + '30' }]}>
                    <MaterialIcons name="email" size={scale(16)} color={colors.warning} />
                    <Text style={[styles.otpHintText, { color: colors.textSecondary }]}>
                      {label(
                        'Check your email inbox (and spam folder) for the code.',
                        'Vérifiez votre boîte mail (et les spams) pour le code.',
                        'تحقق من صندوق الوارد (ومجلد البريد العشوائي) للحصول على الرمز.'
                      )}
                    </Text>
                  </View>

                  {otpError ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                      <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                      <Text style={[styles.errorText, { color: colors.error }]}>{otpError}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, textAlign: 'center' }]}>
                    {label('ENTER 4-DIGIT CODE', 'ENTREZ LE CODE À 4 CHIFFRES', 'أدخل الرمز المكون من 4 أرقام')}
                  </Text>
                  <TextInput
                    style={[styles.otpInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: otpError ? colors.error : colors.warning }]}
                    placeholder="- - - -"
                    placeholderTextColor={colors.textTertiary}
                    value={otpCode}
                    onChangeText={(val) => setOtpCode(val.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    textAlign="center"
                    autoFocus
                    editable={!isLoading}
                  />

                  <Pressable
                    onPress={() => {
                      setOtpError('');
                      if (otpCode.trim().length < 4) {
                        setOtpError(label('Please enter the 4-digit code.', 'Veuillez entrer le code à 4 chiffres.', 'يرجى إدخال الرمز المكون من 4 أرقام.'));
                        return;
                      }
                      setStep('forgot_new_password');
                    }}
                    disabled={isLoading}
                    style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.warning, opacity: isLoading ? 0.5 : pressed ? 0.85 : 1 }]}
                  >
                    <Text style={styles.primaryBtnText}>{label('Continue', 'Continuer', 'متابعة')}</Text>
                  </Pressable>

                  <Pressable onPress={async () => {
                    setLocalLoading(true);
                    const result = await sendOTP(email.trim());
                    setLocalLoading(false);
                    if (result.error) {
                      setOtpError(result.error);
                    } else {
                      setOtpCode('');
                      setOtpError('');
                      notifySuccess();
                    }
                  }} disabled={isLoading} style={styles.toggleBtn}>
                    <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                      {label("Didn't receive the code?", 'Code non reçu ?', 'لم تستلم الرمز؟')}{' '}
                    </Text>
                    <Text style={[styles.toggleLink, { color: isLoading ? colors.textTertiary : colors.warning }]}>
                      {label('Resend', 'Renvoyer', 'إعادة الإرسال')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {/* ═══ FORGOT PASSWORD - SET NEW PASSWORD ═══ */}
              {step === 'forgot_new_password' ? (
                <>
                  <View style={styles.formHeaderRow}>
                    <Pressable onPress={() => { setStep('forgot_otp'); setError(''); }} hitSlop={12}>
                      <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
                    </Pressable>
                    <View style={[styles.accountTypeBadge, { backgroundColor: colors.success + '15' }]}>
                      <MaterialIcons name="lock" size={scale(14)} color={colors.success} />
                      <Text style={[styles.accountTypeBadgeText, { color: colors.success }]}>
                        {label('New Password', 'Nouveau', 'كلمة مرور جديدة')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.otpIconWrap}>
                    <View style={[styles.otpIconCircle, { backgroundColor: colors.success + '12' }]}>
                      <MaterialIcons name="lock-open" size={scale(48)} color={colors.success} />
                    </View>
                  </View>

                  <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center' }]}>
                    {label('Set New Password', 'Définir un nouveau mot de passe', 'تعيين كلمة مرور جديدة')}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                    {label(
                      'Enter your new password. It must contain letters and numbers (min 6 characters).',
                      'Entrez votre nouveau mot de passe. Il doit contenir des lettres et des chiffres (min 6 caractères).',
                      'أدخل كلمة مرورك الجديدة. يجب أن تحتوي على أحرف وأرقام (6 أحرف على الأقل).'
                    )}
                  </Text>

                  {error ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
                      <MaterialIcons name="error-outline" size={scale(16)} color={colors.error} />
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {label('NEW PASSWORD', 'NOUVEAU MOT DE PASSE', 'كلمة المرور الجديدة')}
                  </Text>
                  <PasswordField
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={label('Letters + Numbers, min 6', 'Lettres + Chiffres, min 6', 'أحرف + أرقام، 6 على الأقل')}
                    showState={showNewPassword}
                    setShowState={setShowNewPassword}
                    editable={!isLoading}
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {label('CONFIRM PASSWORD', 'CONFIRMER LE MOT DE PASSE', 'تأكيد كلمة المرور')}
                  </Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInputInner, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder={label('Re-enter your new password', 'Confirmez le mot de passe', 'أعد إدخال كلمة المرور')}
                      placeholderTextColor={colors.textTertiary}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry={!showNewPassword}
                      editable={!isLoading}
                    />
                    <Pressable
                      onPress={() => setShowNewPassword(p => !p)}
                      hitSlop={10}
                      style={styles.eyeInside}
                    >
                      <MaterialIcons name={showNewPassword ? 'visibility-off' : 'visibility'} size={scale(20)} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                  {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword ? (
                    <Text style={[styles.fieldError, { color: colors.error }]}>
                      {label('Passwords do not match.', 'Les mots de passe ne correspondent pas.', 'كلمات المرور غير متطابقة.')}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={async () => {
                      setError('');
                      if (!newPassword.trim() || !confirmNewPassword.trim()) {
                        setError(label('Please fill all fields.', 'Veuillez remplir tous les champs.', 'يرجى ملء جميع الحقول.'));
                        return;
                      }
                      if (newPassword.length < 6) {
                        setError(label('Password must be at least 6 characters.', 'Le mot de passe doit contenir au moins 6 caractères.', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'));
                        return;
                      }
                      const hasLetter = /[a-zA-Z]/.test(newPassword);
                      const hasNumber = /[0-9]/.test(newPassword);
                      if (!hasLetter || !hasNumber) {
                        setError(label('Password must contain both letters and numbers.', 'Le mot de passe doit contenir des lettres et des chiffres.', 'يجب أن تحتوي كلمة المرور على أحرف وأرقام.'));
                        return;
                      }
                      if (newPassword !== confirmNewPassword) {
                        setError(label('Passwords do not match.', 'Les mots de passe ne correspondent pas.', 'كلمات المرور غير متطابقة.'));
                        return;
                      }
                      setLocalLoading(true);
                      const result = await verifyOTPAndLogin(email.trim(), otpCode.trim(), { password: newPassword });
                      setLocalLoading(false);
                      if (result.error) {
                        notifyError();
                        setError(result.error);
                        return;
                      }
                      notifySuccess();
                      setTimeout(async () => {
                        await loadDemoUser();
                        reset();
                        if (onSuccess) onSuccess();
                        else onClose();
                      }, 300);
                    }}
                    disabled={isLoading}
                    style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.success, opacity: isLoading ? 0.5 : pressed ? 0.85 : 1 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {label('Reset Password & Login', 'Reinitialiser et se connecter', 'إعادة تعيين وتسجيل الدخول')}
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const FIELD_HEIGHT = scale(48);      // unified field/button height (slightly reduced from 52)
const BTN_HEIGHT = scale(52);        // unified primary button height
const SP = { s: scale(8), m: scale(12), l: scale(16), xl: scale(20), xxl: scale(24) } as const;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), maxHeight: '92%' },
  modalHeader: { alignItems: 'center', paddingTop: scale(12), paddingBottom: scale(4), paddingHorizontal: SP.xl },
  grabHandle: { width: scale(40), height: scale(4), borderRadius: scale(2), marginBottom: scale(8) },
  closeBtn: { position: 'absolute', right: scale(20), top: scale(12) },
  scrollContent: { paddingHorizontal: SP.xxl, paddingTop: scale(4) },
  title: { fontSize: scale(24), fontWeight: '700', marginBottom: scale(4), fontFamily: 'Cairo-Bold' },
  subtitle: { fontSize: scale(14), lineHeight: 20, marginBottom: SP.xl, fontFamily: 'Cairo-Regular' },
  fieldLabel: { fontSize: scale(11), fontWeight: '700', letterSpacing: 0.8, marginBottom: scale(6), marginTop: SP.s, fontFamily: 'Cairo-Bold' },
  input: {
    height: FIELD_HEIGHT,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: SP.l,
    fontSize: scale(16),
    marginBottom: 2,
    fontFamily: 'Cairo-Regular',
  },
  // compact variant for the signup form (~8-10% shorter)
  inputCompact: {
    height: scale(44),
    paddingVertical: scale(10),
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 2,
  },
  passwordInputInner: {
    height: FIELD_HEIGHT,
    paddingRight: scale(44), // leave room for the eye icon
  },
  eyeInside: {
    position: 'absolute',
    right: scale(12),
    top: 0,
    bottom: 0,
    width: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneRow: { flexDirection: 'row', gap: SP.s, marginBottom: 2 },
  countryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_HEIGHT,
    paddingHorizontal: scale(10),
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    gap: scale(4),
  },
  countryFlag: { fontSize: scale(20), fontFamily: 'Cairo-Regular' },
  countryCode: { fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  phoneInput: { flex: 1, height: FIELD_HEIGHT, borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: SP.l, fontSize: scale(16), fontFamily: 'Cairo-Regular' },
  phoneHint: { fontSize: scale(11), fontWeight: '500', marginTop: scale(4), marginBottom: 2, fontFamily: 'Cairo-Regular' },
  fieldError: { fontSize: scale(12), fontWeight: '500', marginTop: scale(4), marginBottom: scale(4), fontFamily: 'Cairo-Regular' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: SP.m, borderRadius: borderRadius.sm, gap: SP.s, marginBottom: SP.s },
  errorText: { fontSize: scale(13), fontWeight: '500', flex: 1, fontFamily: 'Cairo-Regular' },
  inlineErrorRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(4), marginBottom: 2 },
  inlineErrorText: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  primaryBtn: {
    height: BTN_HEIGHT,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.l,
  },
  primaryBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  toggleBtn: { flexDirection: 'row', justifyContent: 'center', marginTop: SP.l, paddingBottom: SP.s },
  forgotBtn: { alignSelf: 'flex-end', marginTop: SP.s, marginBottom: scale(4), paddingVertical: scale(4) },
  forgotText: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  toggleText: { fontSize: scale(14), fontFamily: 'Cairo-Regular' },
  toggleLink: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  // ─── Google OAuth button & divider ───
  googleBtn: {
    height: BTN_HEIGHT,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(10),
    marginTop: SP.m,
    borderWidth: 1.5,
  },
  googleBtnText: { fontSize: scale(16), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SP.m },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: scale(13), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  // Account type cards (height reduced ~10%)
  accountTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: SP.m,
    marginBottom: SP.m,
  },
  accountTypeCardBuyer: { borderLeftWidth: 3 },
  accountTypeCardSeller: { borderLeftWidth: 3 },
  accountIconCircle: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeTitle: { fontSize: scale(16), fontWeight: '700', marginBottom: 2, fontFamily: 'Cairo-Bold' },
  accountTypeDesc: { fontSize: scale(13), lineHeight: 18, fontFamily: 'Cairo-Regular' },
  formHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeTypeBtn: { paddingHorizontal: scale(8), paddingVertical: scale(4) },
  changeTypeText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  accountTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: scale(20), gap: scale(4) },
  accountTypeBadgeText: { fontSize: scale(12), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), marginTop: SP.l, paddingRight: scale(8) },
  checkbox: { width: scale(24), height: scale(24), borderRadius: scale(6), borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  consentTextWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  consentText: { fontSize: scale(13), lineHeight: 19, fontFamily: 'Cairo-Regular' },
  consentLink: { fontSize: scale(13), fontWeight: '700', lineHeight: 19, textDecorationLine: 'underline', fontFamily: 'Cairo-Bold' },
  otpIconWrap: { alignItems: 'center', marginTop: scale(8), marginBottom: SP.m },
  otpIconCircle: { width: scale(88), height: scale(88), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },
  otpInput: { height: scale(60), borderRadius: borderRadius.md, borderWidth: 2, fontSize: scale(28), fontWeight: '800', letterSpacing: 16, marginBottom: scale(4), fontFamily: 'Cairo-Bold' },
  otpHintBox: { flexDirection: 'row', alignItems: 'center', gap: SP.s, padding: SP.m, borderRadius: scale(10), borderWidth: 1, marginBottom: SP.m },
  otpHintText: { flex: 1, fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },

  demoSection: {
    marginTop: scale(16),
    paddingTop: scale(16),
    borderTopWidth: 1,
  },
  demoTitle: {
    fontSize: scale(11),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoBtnRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  demoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    gap: scale(8),
  },
  demoBtnText: {
    fontSize: scale(14),
    fontWeight: '700',
  },
});