import { Platform } from 'react-native';

let Haptics: any = null;

if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {}
}

export function impactLight() {
  try {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export function impactMedium() {
  try {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export function selection() {
  try {
    Haptics?.selectionAsync?.();
  } catch {}
}

export function notifySuccess() {
  try {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export function notifyWarning() {
  try {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export function notifyError() {
  try {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
