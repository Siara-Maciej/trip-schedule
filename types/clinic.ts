export interface ClinicEmployee {
  id: string;
  name: string;
  role: ClinicRole;
  weeklyHours: number;
  shiftPreferences: ShiftPreference[];
  unavailableDays: number[]; // 0=Mon .. 6=Sun
}

export type ClinicRole = 'lekarz' | 'pielegniarka' | 'rejestratorka' | 'technik' | 'inny';

export const CLINIC_ROLES: { value: ClinicRole; label: string }[] = [
  { value: 'lekarz', label: 'Lekarz' },
  { value: 'pielegniarka', label: 'Pielęgniarka' },
  { value: 'rejestratorka', label: 'Rejestratorka' },
  { value: 'technik', label: 'Technik' },
  { value: 'inny', label: 'Inny' },
];

export type ShiftPreference = 'rano' | 'popoludnie' | 'caly_dzien';

export const SHIFT_PREFERENCES: { value: ShiftPreference; label: string }[] = [
  { value: 'rano', label: 'Rano (8-14)' },
  { value: 'popoludnie', label: 'Popołudnie (14-20)' },
  { value: 'caly_dzien', label: 'Cały dzień (8-20)' },
];

export interface ClinicConfig {
  openTime: string;  // "HH:MM"
  closeTime: string; // "HH:MM"
  workDays: number[]; // 0=Mon .. 6=Sun (selected days)
  minStaffPerShift: number;
  weekStartDate: string; // ISO date string
}

export interface ClinicShift {
  employeeId: string;
  employeeName: string;
  role: ClinicRole;
  day: number; // 0=Mon .. 6=Sun
  startHour: number;
  endHour: number;
}

export interface ClinicScheduleResult {
  shifts: ClinicShift[];
  weekLabel: string;
  warnings: string[];
}
