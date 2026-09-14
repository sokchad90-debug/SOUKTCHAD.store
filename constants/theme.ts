export const lightColors = {
  primary: '#6366F1',
  primaryLight: '#A5B4FC',
  primaryDark: '#4F46E5',
  secondary: '#0EA5E9',
  secondaryLight: '#7DD3FC',
  accent: '#F59E0B',
  accentLight: '#FDE68A',
  background: '#F8FAFC',
  backgroundSecondary: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  verified: '#3B82F6',
  verifiedLight: '#DBEAFE',
  pinned: '#8B5CF6',
  pinnedLight: '#EDE9FE',
  chatBubbleSent: '#6366F1',
  chatBubbleReceived: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.5)',
  shimmer: '#E2E8F0',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarInactive: '#94A3B8',
  statusBar: 'dark-content' as const,
};

export const darkColors = {
  primary: '#B9A7FF',        // prices & active elements
  primaryLight: '#CDBFFF',
  primaryDark: '#B9A7FF',
  secondary: '#A9C7FF',      // links
  secondaryLight: '#A9C7FF',
  accent: '#F6D681',
  accentLight: '#514322',
  background: '#242426',
  backgroundSecondary: '#303034',
  surface: '#303034',        // cards & search
  surfaceElevated: '#303034',
  textPrimary: '#F2F0EB',
  textSecondary: '#C3C0CA',
  textTertiary: '#C3C0CA',
  textInverse: '#242426',
  border: '#48484F',         // separators
  borderLight: '#36363B',    // around images
  error: '#F87171',
  errorLight: '#3A2323',
  success: '#78DCAA',        // stock & delivery
  successLight: '#1F3D30',
  warning: '#F6D681',
  warningLight: '#514322',
  verified: '#A9C7FF',
  verifiedLight: '#2A3448',
  pinned: '#B9A7FF',
  pinnedLight: '#39276A',
  chatBubbleSent: '#39276A',
  chatBubbleReceived: '#303034',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shimmer: '#36363B',
  tabBar: '#242426',
  tabBarBorder: '#48484F',
  tabBarInactive: '#C3C0CA',
  statusBar: 'light-content' as const,
};

export type ThemeColors = {
  [K in keyof typeof lightColors]: (typeof lightColors)[K] | (typeof darkColors)[K]
};

export const typography = {
  heroPrice: { fontSize: 36, fontWeight: '700' as const, fontFamily: 'Cairo-Bold' },
  pageTitle: { fontSize: 24, fontWeight: '700' as const, fontFamily: 'Cairo-Bold' },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Cairo-Bold' },
  cardTitle: { fontSize: 14, fontWeight: '600' as const, fontFamily: 'Cairo-SemiBold' },
  cardPrice: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'Cairo-Bold' },
  body: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'Cairo-Regular' },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, fontFamily: 'Cairo-SemiBold' },
  caption: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'Cairo-Regular' },
  captionBold: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Cairo-SemiBold' },
  small: { fontSize: 11, fontWeight: '500' as const, fontFamily: 'Cairo-Medium' },
  label: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, fontFamily: 'Cairo-SemiBold' },
  button: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'Cairo-SemiBold' },
  input: { fontSize: 16, fontWeight: '400' as const, fontFamily: 'Cairo-Regular' },
  chatMessage: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'Cairo-Regular' },
  chatTime: { fontSize: 11, fontWeight: '400' as const, fontFamily: 'Cairo-Regular' },
  badge: { fontSize: 10, fontWeight: '700' as const, fontFamily: 'Cairo-Bold' },
  tabLabel: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Cairo-SemiBold' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
};
