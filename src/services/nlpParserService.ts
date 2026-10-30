// ==========================================
// DAYCRAFT — NATURAL LANGUAGE QUICK CAPTURE
// Deterministic offline parser for tasks, habits & events
// ==========================================

import { Priority } from '../domain/models';
import { addDays, formatLocalDate, parseLocalDate } from './streakService';

export interface ParsedQuickCapture {
  rawText: string;
  detectedType: 'task' | 'habit' | 'event' | 'focus';
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  durationMinutes?: number;
  priority?: Priority;
  tags: string[];
  recurrence?: 'daily' | 'weekly' | 'weekdays';
  habitTargetValue?: number;
  habitTargetUnit?: string;
  confidence: number; // 0 to 1
}

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Deterministically parse user quick capture text into structured fields.
 */
export function parseNaturalLanguageInput(
  input: string,
  referenceDate: Date = new Date()
): ParsedQuickCapture {
  const todayStr = formatLocalDate(referenceDate);
  let cleaned = input.trim();

  const tags: string[] = [];
  // Extract #tags
  const tagMatches = cleaned.match(/#(\w+)/g);
  if (tagMatches) {
    for (const tag of tagMatches) {
      tags.push(tag.slice(1).toLowerCase());
      cleaned = cleaned.replace(tag, '').trim();
    }
  }

  // Detect priority: !urgent, !high, !med, !low, or priority words
  let priority: Priority | undefined = undefined;
  if (/!urgent|!p1\b/i.test(cleaned)) {
    priority = 'urgent';
    cleaned = cleaned.replace(/!urgent|!p1\b/gi, '').trim();
  } else if (/!high|!p2\b/i.test(cleaned)) {
    priority = 'high';
    cleaned = cleaned.replace(/!high|!p2\b/gi, '').trim();
  } else if (/!med|!medium|!p3\b/i.test(cleaned)) {
    priority = 'medium';
    cleaned = cleaned.replace(/!med|!medium|!p3\b/gi, '').trim();
  } else if (/!low|!p4\b/i.test(cleaned)) {
    priority = 'low';
    cleaned = cleaned.replace(/!low|!p4\b/gi, '').trim();
  }

  // Detect duration: "for 45 minutes", "for 1 hour", "for 30 mins", "for 2h"
  let durationMinutes: number | undefined = undefined;
  const durationMatch = cleaned.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h|m)\b/i);
  if (durationMatch) {
    const val = parseFloat(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    if (unit.startsWith('h')) {
      durationMinutes = Math.round(val * 60);
    } else {
      durationMinutes = Math.round(val);
    }
    cleaned = cleaned.replace(durationMatch[0], '').trim();
  }

  // Detect recurrence / habit indicators: "every day", "daily", "every monday", "every week"
  let recurrence: 'daily' | 'weekly' | 'weekdays' | undefined = undefined;
  let detectedType: 'task' | 'habit' | 'event' | 'focus' = 'task';

  if (/\bevery\s+day\b|\bdaily\b/i.test(cleaned)) {
    recurrence = 'daily';
    detectedType = 'habit';
    cleaned = cleaned.replace(/\bevery\s+day\b|\bdaily\b/gi, '').trim();
  } else if (/\bevery\s+weekday\b|\bon\s+weekdays\b/i.test(cleaned)) {
    recurrence = 'weekdays';
    detectedType = 'habit';
    cleaned = cleaned.replace(/\bevery\s+weekday\b|\bon\s+weekdays\b/gi, '').trim();
  } else if (/\bevery\s+week\b|\bweekly\b/i.test(cleaned)) {
    recurrence = 'weekly';
    detectedType = 'habit';
    cleaned = cleaned.replace(/\bevery\s+week\b|\bweekly\b/gi, '').trim();
  }

  // Detect date: "today", "tomorrow", "next [day]", "on [day]", specific date YYYY-MM-DD
  let detectedDate: string | undefined = undefined;

  if (/\btoday\b/i.test(cleaned)) {
    detectedDate = todayStr;
    cleaned = cleaned.replace(/\btoday\b/gi, '').trim();
  } else if (/\btomorrow\b/i.test(cleaned)) {
    detectedDate = addDays(todayStr, 1);
    cleaned = cleaned.replace(/\btomorrow\b/gi, '').trim();
  } else {
    // Check weekday: "next friday", "on friday", or bare "friday"
    const weekdayMatch = cleaned.match(/\b(?:next\s+|on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i);
    if (weekdayMatch) {
      const targetDayName = weekdayMatch[1].toLowerCase();
      const targetDayNum = WEEKDAY_NAMES[targetDayName];
      if (targetDayNum !== undefined) {
        const currentDayNum = referenceDate.getDay();
        let daysAhead = targetDayNum - currentDayNum;
        if (daysAhead <= 0) daysAhead += 7; // strictly next occurrence
        detectedDate = addDays(todayStr, daysAhead);
        cleaned = cleaned.replace(weekdayMatch[0], '').trim();
      }
    }
  }

  // Detect time: "at 7 PM", "at 19:00", "at 8:30 am", "7pm", "14:30"
  let detectedTime: string | undefined = undefined;
  const timeMatch = cleaned.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
                    cleaned.match(/\bat\s+(\d{1,2}):(\d{2})\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    detectedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    cleaned = cleaned.replace(timeMatch[0], '').trim();
  }

  // Check if starts with "focus on" or "study"
  if (/^study\b/i.test(cleaned) || /^focus\b/i.test(cleaned)) {
    if (durationMinutes && !detectedDate) {
      detectedType = 'focus';
    }
  }

  // Habit numeric targets: e.g. "read 20 pages", "drink 8 glasses"
  let habitTargetValue: number | undefined = undefined;
  let habitTargetUnit: string | undefined = undefined;
  const targetMatch = cleaned.match(/\b(\d+)\s+(pages|glasses|cups|kms?|miles?|minutes?|reps|words)\b/i);
  if (targetMatch) {
    habitTargetValue = parseInt(targetMatch[1], 10);
    habitTargetUnit = targetMatch[2].toLowerCase();
    if (detectedType !== 'focus') {
      detectedType = 'habit';
    }
  }

  // Clean trailing prepositions & whitespace from title
  let finalTitle = cleaned
    .replace(/^(to\s+|for\s+|at\s+)/i, '')
    .replace(/(\s+at|\s+on|\s+by|\s+for)$/i, '')
    .trim();

  if (!finalTitle) {
    finalTitle = input.trim();
  }

  return {
    rawText: input,
    detectedType,
    title: finalTitle,
    date: detectedDate,
    time: detectedTime,
    durationMinutes,
    priority,
    tags,
    recurrence,
    habitTargetValue,
    habitTargetUnit,
    confidence: 0.9,
  };
}

/**
 * Computes a valid zero-padded HH:mm endTime on the same day, preserving start minutes
 * and clamping at 23:59 so late-evening events never overflow to 24:00+.
 */
export function computeSafeEndTime(startTime: string, durationMinutes: number = 60): string {
  const trimmed = (startTime || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return '10:00';
  }
  const startHours = Math.max(0, Math.min(23, parseInt(match[1], 10)));
  const startMins = Math.max(0, Math.min(59, parseInt(match[2], 10)));
  const startTotal = startHours * 60 + startMins;
  const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : 60;
  const endTotal = Math.min(23 * 60 + 59, Math.max(startTotal + 1, startTotal + safeDuration));
  const endHours = Math.floor(endTotal / 60);
  const endMins = endTotal % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

/**
 * Resolves the HabitScheduleType from NLP parsed recurrence tokens.
 */
export function resolveHabitScheduleFromRecurrence(
  recurrence?: 'daily' | 'weekly' | 'weekdays',
  fallback: 'daily' | 'weekdays' | 'custom' = 'daily'
): 'daily' | 'weekdays' | 'custom' {
  if (recurrence === 'weekdays') return 'weekdays';
  if (recurrence === 'daily') return 'daily';
  if (recurrence === 'weekly') return 'custom';
  return fallback;
}

