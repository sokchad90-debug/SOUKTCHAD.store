# Sokchad — Rebuild README

## Project Version
- **Version**: 1.0.0 (app.json)
- **Package**: com.sokchad.app (production) / com.anonymous.sokchadapp (current dev build)

## Framework Versions
- **React Native**: 0.79.3
- **Expo SDK**: 53.0.9
- **React**: 19.0.0
- **TypeScript**: 5.8.3
- **expo-router**: 5.0.7

## Environment Requirements
- **Node.js**: v22+ (tested with v22.23.2)
- **Java/JDK**: OpenJDK 17
- **Android compileSdk**: 35
- **Android targetSdk**: 35
- **Android minSdk**: 24
- **NDK**: 27.1.12297006
- **Build Tools**: 35.0.0

## Install Dependencies
```bash
cd sokchad
npm install --legacy-peer-deps
```
Note: `--legacy-peer-deps` required due to react-native-dynamic peer conflict with React 19.

## Run Development Build
```bash
npx expo start
```

## Build APK (Release)
```bash
cd android
export JAVA_HOME=/path/to/java-17
./gradlew :app:assembleRelease -x lint --no-daemon
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

## Build AAB (Google Play)
```bash
cd android
./gradlew :app:bundleRelease -x lint --no-daemon
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Build Configuration Notes
- `multiDexEnabled true` in build.gradle (required for 64K+ methods)
- `reactNativeArchitectures=arm64-v8a,x86_64` in gradle.properties
- `usesCleartextTraffic="true"` in AndroidManifest (for local API)
- Release signing: uses debug.keystore (replace with production keystore for release)
- JVM heap: `-Xmx1536m` (required to avoid OOM)

## Environment Variables (names only)
```
EXPO_PUBLIC_SUPABASE_URL=<required>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<required>
```

## Backend
- PHP + MySQL backend via Docker Compose
- API on port 8080 (local)
- MySQL on port 3307 (local)
- Schema: backend/schema.sql (16 tables)
- App API base: http://10.0.2.2:8080 (emulator → host)

## Known Issues
1. TypeScript: ~25 pre-existing type errors from @types/react-native conflicts (non-blocking)
2. `products.php` endpoint not in backend (app falls back to mockData)
3. Supabase credentials in .env are placeholders
4. Seller analytics stats endpoint returns 401 without auth token
5. "System UI isn't responding" may appear on low-memory emulators (emulator issue, not app)

## iOS
- iOS config exists in app.json (bundleIdentifier: com.sokchad.app)
- Run `npx expo prebuild --platform ios` to generate iOS native project
- Then `npx expo run:ios`