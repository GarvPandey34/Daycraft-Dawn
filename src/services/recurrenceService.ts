// ==========================================
// DAYCRAFT — RECURRENCE ENGINE
// Deterministic recurrence without duplicate occurrences
// ==========================================

import { RecurrenceRule } from '../domain/models';
import { addDays, formatLocalDate, parseLocalDate } from './streakService';

/**
 * Calculates the next occurrence date for a recurring task based on a reference completion date.
 */
export function getNextOccurrenceDate(
  currentDueDate: string,
  rule: RecurrenceRule,
  referenceDate: string = formatLocalDate(new Date())
): string | null {
  if (rule.type === 'none') return null;

  const baseDate = currentDueDate > referenceDate ? currentDueDate : referenceDate;
  let nextDateStr = baseDate;

  switch (rule.type) {
    case 'daily':
      nextDateStr = addDays(baseDate, 1);
      break;

    case 'weekdays': {
      let d = parseLocalDate(baseDate);
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6); // Skip Sun(0) and Sat(6)
      nextDateStr = formatLocalDate(d);
      break;
    }

    case 'weekly': {
      if (rule.selectedDays && rule.selectedDays.length > 0) {
        // Find next day of week from selectedDays
        let d = parseLocalDate(baseDate);
        let found = false;
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(d);
          checkDate.setDate(d.getDate() + i);
          if (rule.selectedDays.includes(checkDate.getDay())) {
            nextDateStr = formatLocalDate(checkDate);
            found = true;
            break;
          }
        }
        if (!found) {
          nextDateStr = addDays(baseDate, 7);
        }
      } else {
        nextDateStr = addDays(baseDate, 7);
      }
      break;
    }

    case 'monthly': {
      const d = parseLocalDate(baseDate);
      d.setMonth(d.getMonth() + 1);
      nextDateStr = formatLocalDate(d);
      break;
    }

    case 'custom': {
      const interval = Math.max(1, rule.intervalDays || 1);
      nextDateStr = addDays(baseDate, interval);
      break;
    }
  }

  // Check end date boundary
  if (rule.endDate && nextDateStr > rule.endDate) {
    return null;
  }

  return nextDateStr;
}

/**
 * Validates that an occurrence does not already exist
 */
export function hasDuplicateOccurrence(
  existingDates: string[],
  targetDate: string
): boolean {
  return existingDates.includes(targetDate);
}
