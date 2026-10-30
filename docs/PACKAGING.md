# Daycraft — Native Packaging, Build & Distribution Guide

Daycraft is architected as a **single shared React 19 + TypeScript + Vite 8 codebase** that runs natively on:

1. **Windows 10 / 11 Desktop** (`com.daycraft.desktop`, v`1.0.0`) via **Tauri 2** (Rust + Microsoft Edge WebView2)
2. **Android 7.0+ Devices** (`com.daycraft.app`, v`1.0.0`, API 24–35) via **Capacitor**
3. **Modern Web Browsers** (Chrome, Edge, Firefox, Safari) as an offline-capable SPA

All three targets share the exact same `DatabaseManager` (`daycraft_database_v1`), 9 theme presets, 19 achievements, procedural Web Audio synthesizer, and verified `.daycraft` JSON backup & restore system without requiring any cloud account or remote server.

---

## 1. Prerequisites by Target Platform

### Shared Frontend Prerequisites (All Targets)
- **Node.js**: v20.x LTS or v22.x LTS
- **npm**: v10+

Install project dependencies:
```bash
npm install
```

### Windows Desktop Prerequisites (Tauri 2)
To compile native Windows `.exe` (NSIS) and `.msi` (WiX) installers on a Windows 10/11 machine:
1. **Microsoft Visual Studio C++ Build Tools** (2022):
   - Install *Desktop development with C++* workload and the *Windows 10/11 SDK*.
2. **Rust Toolchain** (`rustup`, Rust `1.77.2+`, `stable-x86_64-pc-windows-msvc`):
   ```powershell
   winget install --id Rustlang.Rustup -e
   ```
3. **Microsoft Edge WebView2 Runtime**:
   - Pre-installed on Windows 11 and modern Windows 10 systems. The Tauri NSIS/MSI installer automatically bootstraps WebView2 if missing.

*(Optional)* If you want to install the Tauri CLI and plugins via npm on your build machine:
```bash
npm install -D @tauri-apps/cli@^2.0.0
npm install @tauri-apps/api@^2.0.0 @tauri-apps/plugin-dialog@^2.0.0 @tauri-apps/plugin-fs@^2.0.0 @tauri-apps/plugin-notification@^2.0.0
```

### Android Prerequisites (Capacitor)
To compile native Android `.apk` and `.aab` packages:
1. **Java Development Kit (JDK 17 or JDK 21)** (bundled with Android Studio Ladybug / Koala or installable via Adoptium Temurin).
2. **Android Studio** with:
   - Android SDK Platform 35 (Android 15)
   - Android SDK Build-Tools 35.0.0
   - Android SDK Command-line Tools

*(Optional)* If initializing or updating Capacitor CLI/plugins on your build machine:
```bash
npm install @capacitor/core@^7.0.0 @capacitor/app@^7.0.0 @capacitor/local-notifications@^7.0.0 @capacitor/filesystem@^7.0.0 @capacitor/share@^7.0.0 @capacitor/status-bar@^7.0.0
npm install -D @capacitor/cli@^7.0.0 @capacitor/android@^7.0.0
```

---

## 2. Web Browser Build & Verification

### Development Server
```bash
npm run dev
```
Runs at `http://localhost:3000`.

### TypeScript Type Check & Automated Regression Suite
```bash
npm run lint
npm test
```

### Production Frontend Bundle (`dist/`)
```bash
npm run build
```
Outputs optimized static assets to `/dist`, which is consumed by both Tauri (`frontendDist: "../dist"`) and Capacitor (`webDir: "dist"`).

---

## 3. Windows Desktop Packaging (Tauri 2)

### Icon Generation
Generate all required Windows `.ico` and `.png` icon sizes from `/public/icons/icon.svg`:
```bash
npx tauri icon public/icons/icon.svg
```

### Windows Development Mode (Live Reload)
```bash
npm run tauri:dev
# or: npx tauri dev
```
Starts the Vite dev server on `http://localhost:3000` and launches the native Tauri 2 desktop window (`com.daycraft.desktop`).

### Windows Production Build (`.exe` & `.msi`)
```bash
npm run tauri:build
# or: npx tauri build
```

### Output Locations on Windows
- **NSIS Setup `.exe` Installer**:
  `src-tauri/target/release/bundle/nsis/Daycraft_1.0.0_x64-setup.exe`
- **MSI Windows Installer**:
  `src-tauri/target/release/bundle/msi/Daycraft_1.0.0_x64_en-US.msi`
- **Portable Standalone Executable**:
  `src-tauri/target/release/daycraft.exe`

---

## 4. Android Packaging (Capacitor)

### Step 1 — Build Web Assets & Sync to Android
```bash
npm run build
npx cap sync android
```
*(If the full Gradle wrapper is not yet generated on your machine, run `npx cap add android` once before `npx cap sync android`.)*

### Step 2 — Run on an Android Emulator or USB Device
Open the `/android` project in Android Studio:
```bash
npm run cap:open:android
# or: npx cap open android
```
Select your connected Android phone (with *USB Debugging* enabled) or Virtual Device (AVD) and click **Run ▶**.

### Step 3 — Build Debug APK (Command Line)
```bash
cd android
./gradlew assembleDebug
```
- **Debug APK Output**:
  `android/app/build/outputs/apk/debug/app-debug.apk`

Install directly onto a connected Android device via ADB:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4 — Build Signed Release APK & Play Store AAB
1. Generate a release signing keystore (once):
   ```bash
   keytool -genkey -v -keystore daycraft-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias daycraft
   ```
   > **CRITICAL**: Back up `daycraft-release.jks` securely. Android requires the exact same signing key for all future in-place app updates so existing user data in WebView storage is preserved.
2. In Android Studio, select **Build → Generate Signed App Bundle or APK**, or run:
   ```bash
   cd android
   ./gradlew assembleRelease bundleRelease
   ```
- **Release APK Output**:
  `android/app/build/outputs/apk/release/app-release.apk`
- **Play Store App Bundle (`.aab`) Output**:
  `android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Cross-Platform Data Transfer & Backup Safety

Because Daycraft is 100% private and offline-first (no cloud accounts or external servers), each platform stores its database locally:
- **Web Browser**: Origin `localStorage` (`daycraft_database_v1`)
- **Windows (Tauri 2)**: `%LOCALAPPDATA%\com.daycraft.desktop\EBWebView\`
- **Android (Capacitor)**: `/data/data/com.daycraft.app/app_webview/`

### Moving Data Between Browser, Windows, and Android
1. On your source device (e.g., Web Browser or Windows), open **Settings → Local Database Backups & Restore**.
2. Click **Export Verified Backup (.daycraft)**.
   - On Windows (Tauri 2), a native Windows Save File dialog opens.
   - On Android (Capacitor), the native Android Share sheet opens so you can save to Files/Downloads or send directly to another device.
   - On Web Browser, the `.daycraft` archive downloads to your Downloads folder.
3. Transfer the `.daycraft` file to your destination device.
4. On your destination device, open **Settings → Local Database Backups & Restore** and click **Restore From File...**.
5. **Data Protection Safeguards**:
   - Daycraft validates the archive's schema version and `DJB2-32` checksum before touching any local data.
   - If the destination device already has personal records, Daycraft displays a **Backup Restore Confirmation** dialog comparing your **Current Device Data** vs. the **Incoming Backup Archive** (Tasks, Habits, Goals, Projects, Journal Entries, Focus Sessions, Total XP).
   - You can export a safety backup file first, and Daycraft also automatically saves an internal pre-restore safety snapshot (`daycraft_pre_restore_snapshot_v1`) so you can click **Recover Pre-Restore Safety Snapshot** if you ever need to undo a restore.
