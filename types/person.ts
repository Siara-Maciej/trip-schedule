export interface Person {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
  unavailableDays: number[]; // 0=Mon .. 6=Sun
  notes: string;
  createdAt: string;
}
