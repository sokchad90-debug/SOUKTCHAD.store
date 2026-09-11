/**
 * Sokchad — Unified Design System (single source)
 * الهوية: الألوان والخطوط والزوايا والنسب كلها من هنا. لا ألوان خارج النظام.
 * Units: everything in DP. NO density math here (RN dp is density-independent).
 * Do NOT store window-dependent values in StyleSheet — pass via hooks/props.
 */
export const DS = {
  colors: {
    primary: '#5B4FE9',      // purple = price/primary actions
    headerPurple: '#4C1CEA', // header + status bar
    verified: '#2F80ED',
    success: '#16A34A',
    danger: '#EF4444',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    imageNeutral: '#F1F5F9', // neutral gap behind contain images
  },
  fontFamily: {
    regular: 'Cairo-Regular',
    medium: 'Cairo-Medium',
    semiBold: 'Cairo-SemiBold',
    bold: 'Cairo-Bold',
  } as const,
  spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 },
  radius: { card: 10, image: 0, pill: 999 },
  imageRatios: {
    product: 0.78,   // height/width for standard product frames
    sponsored: 1.0,  // sponsored cards are square-ish (reference)
  },
  maxSurfaceWidth: 480, // wide-screen cap policy (documented)
} as const;

export type DesignSystem = typeof DS;
