import React from 'react';
import { Text, TextInput, TextInputProps, TextProps, StyleSheet } from 'react-native';

/**
 * AppText — unified typography component (Phase 4).
 * - Applies Cairo family automatically (weight → font file).
 * - Respects the user's OS font scaling (allowFontScaling stays ON).
 * - maxFontSizeMultiplier caps runaway growth (default 1.35) so containers
 *   grow and wrap instead of clipping prices/actions.
 * - Never divides by fontScale and never disables scaling globally.
 */
const WEIGHT_TO_FONT: Record<string, string> = {
  '400': 'Cairo-Regular',
  '500': 'Cairo-Medium',
  '600': 'Cairo-SemiBold',
  '700': 'Cairo-Bold',
  '800': 'Cairo-Bold',
  normal: 'Cairo-Regular',
  bold: 'Cairo-Bold',
};

export interface AppTextProps extends TextProps {
  /** numeric CSS-like weight: 400 | 500 | 600 | 700 | 800 */
  weight?: 400 | 500 | 600 | 700 | 800;
  /** cap on OS font scaling (default 1.35 — grows, wraps, never clips) */
  maxScale?: number;
}

export function AppText({ weight, maxScale = 1.35, style, ...rest }: AppTextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const w = String(weight ?? (flat as any).fontWeight ?? 400);
  const family = WEIGHT_TO_FONT[w] || (flat as any).fontFamily || 'Cairo-Regular';
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={maxScale}
      {...rest}
      style={[{ fontFamily: family }, style]}
    />
  );
}

/**
 * AppTextInput — Cairo input with the same scaling contract.
 */
export interface AppTextInputProps extends TextInputProps {
  weight?: 400 | 500 | 600 | 700 | 800;
  maxScale?: number;
}

export function AppTextInput({ weight = 400, maxScale = 1.35, style, ...rest }: AppTextInputProps) {
  const family = WEIGHT_TO_FONT[String(weight)] || 'Cairo-Regular';
  return (
    <TextInput
      allowFontScaling
      maxFontSizeMultiplier={maxScale}
      {...rest}
      style={[{ fontFamily: family }, style]}
    />
  );
}

export default AppText;