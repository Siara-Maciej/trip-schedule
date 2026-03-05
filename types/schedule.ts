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

export interface ScheduleParams {
  peopleCount: number;
  hoursPerShift: number;
  durationDays: number;
  minBreakHours: number;
  names?: string[];
  constraints?: ScheduleConstraint[];
}
