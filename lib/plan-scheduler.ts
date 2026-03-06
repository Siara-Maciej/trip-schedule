import type { Person } from '@/types/person';
import type {
  PeriodConfig,
  WorkingHoursConfig,
  StaffConstraints,
  ShiftDefinition,
  PlanShift,
  PlanResult,
} from '@/types/schedule-plan';

const DAY_LABELS = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

/** Get list of dates for the given period config. */
function getDates(period: PeriodConfig): Date[] {
  const dates: Date[] = [];

  if (period.type === 'daterange') {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
  } else if (period.type === 'weekly') {
    const mon = new Date(period.weekStartDate);
    const dayCount = period.includeWeekends ? 7 : 5;
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      dates.push(d);
    }
  } else {
    // monthly
    const year = period.year;
    const month = period.month - 1; // 0-based
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay(); // 0=Sun, 6=Sat
      if (!period.includeWeekends && (dow === 0 || dow === 6)) continue;
      dates.push(d);
    }
  }

  return dates;
}

/** Get shifts for a given day-of-week (0=Mon based). */
function getShiftsForDay(
  wh: WorkingHoursConfig,
  dayOfWeekMon: number, // 0=Mon .. 6=Sun
): ShiftDefinition[] {
  switch (wh.type) {
    case 'continuous':
      return [{ name: 'Zmiana', startTime: '00:00', endTime: '24:00' }];
    case 'fixed':
      return [{ name: 'Zmiana', startTime: wh.startTime, endTime: wh.endTime }];
    case 'shifts':
      return wh.shifts;
    case 'custom': {
      const cfg = wh.days[dayOfWeekMon];
      if (!cfg || !cfg.enabled) return [];
      return cfg.shifts;
    }
  }
}

/** Convert JS Date.getDay() (0=Sun) to our convention (0=Mon). */
function jsDowToMon(jsDow: number): number {
  return jsDow === 0 ? 6 : jsDow - 1;
}

/**
 * Greedy scheduler:
 * For each date, for each shift definition, assign people
 * respecting weekly hours and constraints.
 */
export function generatePlanSchedule(
  people: Person[],
  period: PeriodConfig,
  workingHours: WorkingHoursConfig,
  constraints: StaffConstraints,
): PlanResult {
  const dates = getDates(period);
  const warnings: string[] = [];

  if (dates.length === 0) {
    return { shifts: [], warnings: ['Brak dni w wybranym okresie.'], totalHours: 0, daysCount: 0 };
  }

  // Track hours per person (for weekly limit distribution)
  const hoursUsed = new Map<string, number>();
  for (const p of people) hoursUsed.set(p.id, 0);

  const resultShifts: PlanShift[] = [];

  for (const date of dates) {
    const dowMon = jsDowToMon(date.getDay());
    const dayShifts = getShiftsForDay(workingHours, dowMon);

    if (dayShifts.length === 0) continue;

    const dayLabel = `${DAY_LABELS[date.getDay()]} ${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`;
    const dateStr = date.toISOString().slice(0, 10);

    for (const shiftDef of dayShifts) {
      const startH = parseHour(shiftDef.startTime);
      const endH = shiftDef.endTime === '24:00' ? 24 : parseHour(shiftDef.endTime);
      const shiftHours = endH - startH;

      // Filter available people for this day
      const available = people
        .filter((p) => !p.unavailableDays.includes(dowMon))
        .sort((a, b) => (hoursUsed.get(a.id) ?? 0) - (hoursUsed.get(b.id) ?? 0));

      let assigned = 0;

      for (const person of available) {
        if (assigned >= constraints.maxPerShift) break;

        const used = hoursUsed.get(person.id) ?? 0;
        if (used + shiftHours > person.weeklyHours * Math.max(1, Math.ceil(dates.length / 7))) {
          continue;
        }

        resultShifts.push({
          personId: person.id,
          personName: person.name,
          date: dateStr,
          dayLabel,
          shiftName: shiftDef.name,
          startHour: startH,
          endHour: endH,
        });

        hoursUsed.set(person.id, used + shiftHours);
        assigned++;
      }

      if (assigned < constraints.minPerShift) {
        warnings.push(
          `${dayLabel}, ${shiftDef.name}: przypisano ${assigned}/${constraints.minPerShift} wymaganych`
        );
      }
    }
  }

  const totalHours = resultShifts.reduce((s, sh) => s + (sh.endHour - sh.startHour), 0);

  return {
    shifts: resultShifts,
    warnings,
    totalHours,
    daysCount: dates.length,
  };
}
