# DAYCRAFT ARCHITECTURE & DESIGN SYSTEM

## 1. Overview
Daycraft is an offline-first, private personal life management system designed for Android and Windows. It brings together tasks, projects, habits, goals, calendar, focus sprints, study sessions, wellness, journaling, and on-device offline AI without any remote database, cloud analytics, or external accounts.

## 2. Core Principles
1. **Privacy By Default:** Zero telemetry, zero cloud DB, zero remote LLM API calls.
2. **Offline-First:** Full operational capability without an internet connection.
3. **Deterministic Persistence:** All records reside in structured local tables with forward schema migrations and checksummed archive backups.
4. **Forgiving Habit Tracking:** Planned rest days and excused skips preserve streaks.
5. **Calm Aesthetic:** 6 theme presets (Warm Paper, Midnight, Sage Garden, Lavender Haze, Sunset, Monochrome) with immediate token switching.

## 3. Storage & Schema
- Managed via `DatabaseManager` in `src/database/db.ts`.
- Structured tables:
  - `tasks`: Full lifecycle, priorities, recurrence rules, dependencies.
  - `habits` & `habitOccurrences`: Target values, schedules, rest days, completion statuses.
  - `projects` & `projectMilestones`: Progress calculated deterministically as `completed / total`.
  - `goals` & `goalMilestones`: Qualitative & measurable metric goals.
  - `calendarEvents` & `timeBlocks`: Scheduled slots with overlap conflict awareness.
  - `focusSessions`: Monotonic time records.
  - `studySubjects` & `studySessions`: Learning curriculum logs.
  - `wellnessTrackers` & `wellnessEntries`: Body metrics strictly excluded from AI by default.
  - `journalEntries`: Structured reflections with mood and tags.
  - `achievements` & `xpLedger`: Anti-farming gamification.

## 4. Platform Adapters
Explicit adapter contracts in `src/platform/adapters.ts`:
- `DatabaseAdapter`
- `NotificationAdapter`
- `SecureStorageAdapter` (Salted SHA-256 PIN hash + rate limiter)
- `FileSystemAdapter` (Archive export/import)
- `LocalAIAdapter` (GGUF model catalog + read-only tool grounding)
- `DeviceCapabilitiesAdapter`
- `AudioAdapter` (Procedural Web Audio API sound synthesis)
