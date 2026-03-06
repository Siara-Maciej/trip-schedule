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

// Ograniczenie: maksymalna liczba osób w bloku nocnym
export interface NightShiftLimit {
  type: 'nightShiftLimit';
  maxPeople: number;      // np. 1
  nightStartHour: number; // np. 22
  nightEndHour: number;   // np. 6
}

// Ograniczenie: osoba nie chce pracować w danych godzinach
export interface PersonBlockedHours {
  type: 'personBlocked';
  personId: number;       // 0-based
  startHour: number;      // np. 22
  endHour: number;        // np. 6
}

export type ScheduleConstraint = NightShiftLimit | PersonBlockedHours;

export interface PersonConfig {
  name: string;
  hoursPerShift: number;       // długość zmiany w godzinach
  minBreakHours: number;       // minimalna przerwa w godzinach
  blockedHours: { startHour: number; endHour: number } | null;
  canWorkAtNight: boolean;
}

export interface ScheduleParams {
  peopleCount: number;
  /** Total hours to schedule (derived from start/end dates) */
  totalHours: number;
  /** Clock hour (0-23) at which the schedule starts on day 1; default 0 */
  startHourOffset?: number;
  names?: string[];
  /** Per-person shift duration; falls back to 8 if missing */
  perPersonShiftHours?: number[];
  /** Per-person min break; falls back to 11 if missing */
  perPersonMinBreak?: number[];
  constraints?: ScheduleConstraint[];
}
