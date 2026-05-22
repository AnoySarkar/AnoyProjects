import type { GoalResetPeriod } from '../types';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string; // YYYY-MM-DD
  totalDays: number;
  remainingDays: number; // remaining in cycle, including today
  elapsedDays: number; // elapsed in cycle, including today
  currentDayNumInCycle: number; // 1-indexed day number in cycle
  isCurrentCycle: boolean; // whether today is in this cycle
}

/**
 * Returns the exact billing range for a goal given its configured month (YYYY-MM), billing reset day (1-31),
 * and the reset period type ('daily' | 'weekly' | 'monthly').
 */
export function getGoalCycleRange(
  monthStr: string, 
  resetDay: number = 1, 
  resetPeriod: GoalResetPeriod = 'monthly'
): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDateStr = (d: Date) => {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  let startDate: Date;
  let endDate: Date;

  if (resetPeriod === 'daily') {
    // Daily reset: range is literally today!
    startDate = new Date(today);
    endDate = new Date(today);
    
    return {
      startDate,
      endDate,
      startDateStr: toDateStr(startDate),
      endDateStr: toDateStr(endDate),
      totalDays: 1,
      remainingDays: 1,
      elapsedDays: 1,
      currentDayNumInCycle: 1,
      isCurrentCycle: true
    };
  } else if (resetPeriod === 'weekly') {
    // Weekly reset: starts on Monday of this week, ends on Sunday (6 days later)
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    startDate = new Date(today);
    startDate.setDate(today.getDate() + daysToMonday);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const elapsedDiff = Math.abs(today.getTime() - startDate.getTime());
    const elapsedDays = Math.floor(elapsedDiff / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate,
      endDate,
      startDateStr: toDateStr(startDate),
      endDateStr: toDateStr(endDate),
      totalDays: 7,
      remainingDays: Math.max(1, 7 - elapsedDays + 1),
      elapsedDays,
      currentDayNumInCycle: elapsedDays,
      isCurrentCycle: true
    };
  } else {
    // Standard Monthly Reset Period
    const [yStr, mStr] = monthStr.split('-');
    const year = parseInt(yStr);
    const month = parseInt(mStr);

    // Determine max days in the start month to avoid out-of-bounds overflows
    const maxDays = new Date(year, month, 0).getDate();
    const actualResetDay = Math.min(Math.max(1, resetDay), maxDays);

    // Start Date: Month is 0-indexed in JS Dates
    startDate = new Date(year, month - 1, actualResetDay);
    endDate = new Date(year, month, actualResetDay - 1);

    const startDateStr = toDateStr(startDate);
    const endDateStr = toDateStr(endDate);

    // Calculate total days inside this billing cycle range
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

    const todayTime = today.getTime();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    let remainingDays = 0;
    let elapsedDays = 0;
    let currentDayNumInCycle = 1;
    let isCurrentCycle = false;

    if (todayTime < startTime) {
      remainingDays = totalDays;
      elapsedDays = 0;
      currentDayNumInCycle = 1;
      isCurrentCycle = false;
    } else if (todayTime > endTime) {
      remainingDays = 0;
      elapsedDays = totalDays;
      currentDayNumInCycle = totalDays;
      isCurrentCycle = false;
    } else {
      isCurrentCycle = true;
      const elapsedDiff = Math.abs(todayTime - startTime);
      elapsedDays = Math.floor(elapsedDiff / (1000 * 60 * 60 * 24)) + 1;
      currentDayNumInCycle = elapsedDays;
      remainingDays = Math.max(1, totalDays - elapsedDays + 1);
    }

    return {
      startDate,
      endDate,
      startDateStr,
      endDateStr,
      totalDays,
      remainingDays,
      elapsedDays,
      currentDayNumInCycle,
      isCurrentCycle
    };
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayStr(): string {
  const today = new Date();
  return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
}

/**
 * Converts a hex color string (e.g. "#00f0ff" or "00f0ff") to an R,G,B comma-separated triplet.
 * Returns empty string if preset is found, or default cyan on failure.
 */
export function hexToRgb(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 240, 255';
}
