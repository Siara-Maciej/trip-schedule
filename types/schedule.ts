export type ShiftType = 'WORK' | 'REST';

export interface Shift {
  personId: number;
  personName: string;
  day: number;           // 1-based
  startHour: number;     // 0-23
  endHour: number;       // 1-24 (24 = północ następnego dnia)
  type: ShiftType;
}

export interface ScheduleResult {
  shifts: Shift[];
  valid: boolean;
  errors: string[];
  coverageGaps: TimeGap[];
  stats: PersonStats[];
}

export interface PersonStats {
  personId: number;
  personName: string;
  totalWorkHours: number;
  shiftsCount: number;
  minBreakActual: number; // najkrótsza faktyczna przerwa
}

export interface TimeGap {
  day: number;
  startHour: number;
  endHour: number;
}

export interface ScheduleParams {
  peopleCount: number;
  hoursPerShift: number;
  durationDays: number;
  minBreakHours: number;
  names?: string[];
}
