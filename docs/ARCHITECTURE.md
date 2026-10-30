# DAYCRAFT ARCHITECTURE & DESIGN SYSTEM

## 1. Overview
Daycraft is an offline-first, private personal life management system designed for Windows (`com.daycraft.desktop` via Tauri 2), Android (`com.daycraft.app` via Capacitor), and modern Web Browsers. It brings together tasks, projects, habits, routines, goals, calendar, focus sprints, study sessions, wellness, journaling, achievements, and XP progression without any remote database, cloud analytics, or external accounts.

## 2. Core Principles
1. **Privacy By Default:** Zero telemetry, zero cloud DB, zero mandatory accounts.
2. **Offline-First:** 100% operational capability without an internet connection across Web, Windows, and Android.
3. **Deterministic Persistence:** All records reside in structured local storage (`daycraft_database_v1`) with forward schema validation, automatic pre-restore safety snapshots (`daycraft_pre_restore_snapshot_v1`), and `DJB2-32` checksummed `.daycraft` archive backups.
4. **Forgiving Habit Tracking:** Planned rest days and excused skips preserve streaks.
5. **Calm Aesthetic:** 9 theme presets (Warm Paper, Forest, Midnight, Sage Garden, Lavender Haze, Sunset, Monochrome, Cyberpunk Neon, Nordic Aurora) with immediate token switching and native status bar synchronization.

## 3. Storage & Schema
- Managed via `DatabaseManager` in `src/database/db.ts` (`SCHEMA_VERSION = 1`).
- Structured collections:
  - `tasks`: Full lifecycle (`inbox`, `todo`, `in_progress`, `completed`), priorities, recurrence rules, dependencies.
  - `habits`, `habitOccurrences`, & `habitRoutines`: Target values, schedules, rest days, completion statuses, and routine cascades.
  - `projects` & `projectMilestones`: Progress calculated deterministically as `completed / total`.
  - `goals` & `goalMilestones`: Qualitative & measurable metric goals.
  - `calendarEvents` & `timeBlocks`: Scheduled slots with overlap conflict awareness.
  - `focusSessions`: Monotonic time records (`daycraft_active_focus_timer_v1`) with idempotent expiration reconciliation.
  - `studySubjects` & `studySessions`: Learning curriculum logs.
  - `wellnessTrackers` & `wellnessEntries`: Personal health and energy metrics.
  - `journalEntries`: Structured reflections with mood and tags.
  - `achievements` & `xpLedger`: Anti-farming gamification with 19 achievements and level rewards.

## 4. Platform Adapters & Native Bridges
Unified platform detection (`src/platform/platformDetect.ts`), lifecycle management (`src/platform/lifecycleAdapter.ts`), and adapter contracts (`src/platform/adapters.ts`):
- `DeviceCapabilitiesAdapter`: Detects `windows` (Tauri 2), `android` (Capacitor), or `web` runtime shells.
- `NotificationAdapter`: Bridges Android Capacitor `LocalNotifications` (scheduled exact alarms + notification channels), Windows Tauri 2 `notification` plugin, and Web `Notification` API with deterministic scheduling and cancellation.
- `FileSystemAdapter`: Bridges Windows Tauri 2 native `dialog` + `fs` plugins, Android Capacitor `Filesystem` + `Share` sheet, and Web `<a download>` / `<input type="file">`.
- `LifecycleAdapter`: Coordinates Android hardware back-button priority (modals → mobile drawer → home navigation → app minimize), background/foreground timer & Web Audio reconciliation, and native status bar theme styling.
- `SecureStorageAdapter`: Salted SHA-256 PIN hash with brute-force lockout protection.
- `AudioAdapter`: Procedural Web Audio API soundscape synthesizer (`src/services/soundService.ts`) with automatic suspended `AudioContext` lifecycle recovery.
