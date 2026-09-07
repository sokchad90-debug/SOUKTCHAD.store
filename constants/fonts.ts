// Cairo font family helper for Sokchad app
// Usage: import { fonts } from '@/constants/fonts'; then use fontFamily: fonts.bold
// Font files are in assets/fonts/ and registered via expo-font plugin in app.json

export const fonts = {
  regular: 'Cairo-Regular',
  medium: 'Cairo-Medium',
  semiBold: 'Cairo-SemiBold',
  bold: 'Cairo-Bold',
} as const;

export type FontWeight = keyof typeof fonts;

// Helper to get fontFamily by weight
export function getFont(weight: FontWeight = 'regular'): string {
  return fonts[weight];
}

// Default font for the entire app — use in Text style props
export const defaultFontFamily = fonts.regular;