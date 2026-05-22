export type GoalCategory = 'ai' | 'self' | 'projects';
export type GoalUnitType = 'count' | 'duration';

export interface LogEntry {
  id: string;
  goalId: string;
  date: string; // YYYY-MM-DD
  value: number; // For duration, stored in seconds. For count, stored in integers.
  createdAt: string;
}

export type GoalResetPeriod = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  id: string;
  name: string;
  category: GoalCategory;
  unitType: GoalUnitType;
  target: number; // For count: absolute number (e.g. 500). For duration: total seconds (e.g. 1800 for 30m).
  unitName: string; // e.g. "videos", "images", "minutes"
  color: string; // e.g., 'pink' | 'blue' | 'green' | 'purple' | 'orange' (neon variations)
  icon: string; // lucide icon identifier
  month: string; // YYYY-MM (e.g., "2026-05")
  resetDay?: number; // Billing cycle reset day (1-31)
  resetPeriod?: GoalResetPeriod; // 'daily' | 'weekly' | 'monthly'
  groupName?: string; // Sub-group or custom label (e.g., 'Runway Account A', 'Gemini')
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null; // Date ISO string when unlocked, or null
  goalId?: string; // Optional: associated with a specific goal
}

export interface GlobalStats {
  totalGoalsCount: number;
  completedGoalsCount: number;
  totalLoggedToday: number;
  currentStreak: number;
}
