# Sokchad App Signing

## Release Keystore
- **File**: `keys/sokchad-release.keystore`
- **Store Password**: `sokchad2026`
- **Key Alias**: `sokchad-key`
- **Key Password**: `sokchad2026`

## Build Command
```bash
cd android
export JAVA_HOME=/opt/data/jdk-17.0.13+11
export ANDROID_HOME=/opt/android-sdk
./gradlew assembleRelease -x lint --no-daemon
```

## Output
```
android/app/build/outputs/apk/release/app-release.apk
```

## build.gradle signingConfigs
```groovy
signingConfigs {
    release {
        storeFile file('../keys/sokchad-release.keystore')
        storePassword 'sokchad2026'
        keyAlias 'sokchad-key'
        keyPassword 'sokchad2026'
    }
}
```

## Owner
Sokchad — Chad P2P Marketplace
© 2026 Sokchad. All rights reserved.