# DAYCRAFT NATIVE PACKAGING & RELEASE GUIDE

## Android (Capacitor)
To build a signed Android APK or Android App Bundle (AAB):

### Prerequisites
- Node.js 20+
- Android Studio / Android SDK (API level 34+)
- Java 17 (JDK)

### Steps
1. Install dependencies and compile web assets:
   ```bash
   npm install
   npm run build
   ```
2. Add and sync the Android native platform:
   ```bash
   npx cap add android
   npx cap sync android
   ```
3. Open in Android Studio or compile via Gradle:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   The release APK will be located at `android/app/build/outputs/apk/release/app-release.apk`.

---

## Windows Desktop (Tauri 2)
To build the native Windows `.msi` installer or standalone `.exe`:

### Prerequisites
- Node.js 20+
- Rust & Cargo (1.78+)
- Microsoft Visual Studio C++ Build Tools
- WebView2 Runtime (pre-installed on Windows 10/11)

### Steps
1. Build frontend bundle:
   ```bash
   npm run build
   ```
2. Build Tauri release bundle:
   ```bash
   cargo tauri build
   ```
   The installer will be generated at `src-tauri/target/release/bundle/msi/Daycraft_1.0.0_x64_en-US.msi`.
