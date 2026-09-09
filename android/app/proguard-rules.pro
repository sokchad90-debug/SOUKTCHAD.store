# Add project specific ProGuard rules here.

# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.hermes.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.core.ExportedModule { *; }
-keep class * implements expo.modules.core.interfaces.Package { *; }
-keepclassmembers class * { @expo.modules.core.interfaces.ExportedMethod <methods>; }

# React Native vector icons
-keep class com.oblador.vectoricons.** { *; }

# Safe area, screens, gestures
-keep class com.reactcommunity.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# Supabase
-keep class io.supabase.** { *; }
-keep class com.supabase.** { *; }

# Keep all native modules
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * implements com.facebook.react.bridge.UIManager { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Expo image
-keep class expo.modules.image.** { *; }

# Keep model classes (Gson/Jackson compatibility)
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Don't warn about missing classes
-dontwarn javax.annotation.**
-dontwarn org.jetbrains.annotations.**