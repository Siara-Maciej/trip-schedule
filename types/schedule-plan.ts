// ── Period ──────────────────────────────────────────────
export type PeriodType = 'daterange' | 'weekly' | 'monthly';

export interface DateRangePeriod {
  type: 'daterange';
  startDate: string; // ISO
  startTime: string; // "HH:MM"
  endDate: string;
  endTime: string;
}

export interface WeeklyPeriod {
  type: 'weekly';
  weekStartDate: string; // ISO (Monday)
  includeWeekends: boolean;
}

export interface MonthlyPeriod {
  type: 'monthly';
  year: number;
  month: number; // 1-12
  includeWeekends: boolean;
}

export type PeriodConfig = DateRangePeriod | WeeklyPeriod | MonthlyPeriod;

// ── Working hours ───────────────────────────────────────
export type WorkingHoursType = 'continuous' | 'fixed' | 'shifts' | 'custom';

export interface ShiftDefinition {
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface ContinuousHours {
  type: 'continuous'; // 24h
}

export interface FixedHours {
  type: 'fixed';
  startTime: string;
  endTime: string;
}

export interface ShiftBasedHours {
  type: 'shifts';
  shifts: ShiftDefinition[];
}

export interface DayConfig {
  enabled: boolean;
  shifts: ShiftDefinition[];
}

export interface CustomHours {
  type: 'custom';
  // 0=Mon .. 6=Sun
  days: Record<number, DayConfig>;
}

export type WorkingHoursConfig =
  | ContinuousHours
  | FixedHours
  | ShiftBasedHours
  | CustomHours;

// ── Constraints ─────────────────────────────────────────
export interface StaffConstraints {
  minPerShift: number;
  maxPerShift: number;
  /** If true, a person can only work one shift per day */
  oneShiftPerDay: boolean;
  /** If true, rotate shift types evenly across people */
  fairDistribution: boolean;
}

// ── Template (reusable preset) ──────────────────────────
export interface ScheduleTemplate {
  id: string;
  name: string;
  periodType: PeriodType;
  workingHours: WorkingHoursConfig;
  constraints: StaffConstraints;
  includeWeekends: boolean;
  createdAt: string;
}

// ── Plan (a concrete schedule request) ──────────────────
export interface SchedulePlan {
  templateId: string | null;
  period: PeriodConfig;
  workingHours: WorkingHoursConfig;
  constraints: StaffConstraints;
  personIds: string[];
}

// ── Result ──────────────────────────────────────────────
export interface PlanShift {
  personId: string;
  personName: string;
  date: string;       // ISO date
  dayLabel: string;   // "Pon 07.04"
  shiftName: string;  // shift name or "Zmiana"
  startHour: number;
  endHour: number;
}

export interface PlanResult {
  shifts: PlanShift[];
  warnings: string[];
  totalHours: number;
  daysCount: number;
}
