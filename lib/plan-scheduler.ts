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
    const year = period.year;
    const month = period.month - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      if (!period.includeWeekends && (dow === 0 || dow === 6)) continue;
      dates.push(d);
    }
  }

  return dates;
}

/** Get shifts for a given day-of-week (0=Mon based). */
function getShiftsForDay(
  wh: WorkingHoursConfig,
  dayOfWeekMon: number,
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

function jsDowToMon(jsDow: number): number {
  return jsDow === 0 ? 6 : jsDow - 1;
}

const MIN_REST_HOURS = 8;

/**
 * Build an hourly coverage array for a set of assigned shifts on a day.
 * Returns a map: hour → number of people covering that hour.
 */
function buildHourlyCoverage(
  dayAssignments: { startH: number; endH: number }[],
): Map<number, number> {
  const coverage = new Map<number, number>();
  for (const a of dayAssignments) {
    for (let h = a.startH; h < a.endH; h++) {
      coverage.set(h, (coverage.get(h) ?? 0) + 1);
    }
  }
  return coverage;
}

/**
 * Check if adding a person to a shift would exceed maxPerShift
 * for any hour that the shift covers.
 */
function wouldExceedMax(
  currentCoverage: Map<number, number>,
  startH: number,
  endH: number,
  max: number,
): boolean {
  for (let h = startH; h < endH; h++) {
    if ((currentCoverage.get(h) ?? 0) >= max) return true;
  }
  return false;
}

/**
 * Check if any hour in the given range is below minimum staffing.
 */
function hoursBelow(
  coverage: Map<number, number>,
  startH: number,
  endH: number,
  min: number,
): number[] {
  const below: number[] = [];
  for (let h = startH; h < endH; h++) {
    if ((coverage.get(h) ?? 0) < min) below.push(h);
  }
  return below;
}

/**
 * Greedy scheduler with:
 * - Overlapping shift support with hourly coverage validation
 * - oneShiftPerDay: person works at most one shift per day
 * - fairDistribution: rotate shift types evenly across people
 * - min/max enforced per hour (not per shift), so overlapping shifts count together
 */
export function generatePlanSchedule(
  people: Person[],
  period: PeriodConfig,
  workingHours: WorkingHoursConfig,
  constraints: StaffConstraints,
): PlanResult {
  const dates = getDates(period);
  const warnings: string[] = [];

  const oneShiftPerDay = constraints.oneShiftPerDay ?? true;
  const fairDistribution = constraints.fairDistribution ?? true;

  if (dates.length === 0) {
    return { shifts: [], warnings: ['Brak dni w wybranym okresie.'], totalHours: 0, daysCount: 0 };
  }

  if (people.length === 0) {
    return { shifts: [], warnings: ['Brak przypisanych osób.'], totalHours: 0, daysCount: dates.length };
  }

  // Track total hours per person
  const hoursUsed = new Map<string, number>();
  for (const p of people) hoursUsed.set(p.id, 0);

  // Track last shift end (absolute hour from period start)
  const lastShiftEnd = new Map<string, number>();

  // Track whether person has been assigned on a date (for oneShiftPerDay)
  const assignedOnDate = new Set<string>();

  // Track per-person shift type counts for fair distribution
  const shiftTypeCounts = new Map<string, Map<string, number>>();
  for (const p of people) shiftTypeCounts.set(p.id, new Map());

  // Track all assignments for a given date: dateStr → [{personId, startH, endH}]
  const dayAssignments = new Map<string, { personId: string; startH: number; endH: number }[]>();

  const resultShifts: PlanShift[] = [];
  const totalWeeks = Math.max(1, Math.ceil(dates.length / 7));
  const periodStartTime = dates[0].getTime();

  for (const date of dates) {
    const dowMon = jsDowToMon(date.getDay());
    const dayShifts = getShiftsForDay(workingHours, dowMon);

    if (dayShifts.length === 0) continue;

    const dayLabel = `${DAY_LABELS[date.getDay()]} ${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`;
    const dateStr = date.toISOString().slice(0, 10);
    const dayOffsetHours = (date.getTime() - periodStartTime) / (1000 * 60 * 60);

    // Initialize day assignments list
    if (!dayAssignments.has(dateStr)) {
      dayAssignments.set(dateStr, []);
    }

    for (const shiftDef of dayShifts) {
      const startH = parseHour(shiftDef.startTime);
      const endH = shiftDef.endTime === '24:00' ? 24 : parseHour(shiftDef.endTime);
      const shiftHours = endH - startH;

      if (shiftHours <= 0) continue;

      const absoluteStart = dayOffsetHours + startH;
      const absoluteEnd = dayOffsetHours + endH;
      const shiftName = shiftDef.name;

      // Get current hourly coverage for the day (across all shifts)
      const currentDayAssignments = dayAssignments.get(dateStr)!;
      const coverage = buildHourlyCoverage(currentDayAssignments);

      // Filter available people
      const available = people.filter((p) => {
        if (p.unavailableDays.includes(dowMon)) return false;

        // One shift per day
        if (oneShiftPerDay && assignedOnDate.has(`${p.id}:${dateStr}`)) {
          return false;
        }

        // If multiple shifts per day allowed, check time overlap
        if (!oneShiftPerDay) {
          for (const a of currentDayAssignments) {
            if (a.personId === p.id && startH < a.endH && endH > a.startH) return false;
          }
        }

        // Rest period
        const lastEnd = lastShiftEnd.get(p.id);
        if (lastEnd !== undefined && absoluteStart - lastEnd < MIN_REST_HOURS) {
          return false;
        }

        // Hours limit
        const used = hoursUsed.get(p.id) ?? 0;
        if (used + shiftHours > p.weeklyHours * totalWeeks) {
          return false;
        }

        return true;
      });

      // Sort candidates
      let sorted: Person[];

      if (fairDistribution && dayShifts.length > 1) {
        sorted = [...available].sort((a, b) => {
          const aCount = shiftTypeCounts.get(a.id)!.get(shiftName) ?? 0;
          const bCount = shiftTypeCounts.get(b.id)!.get(shiftName) ?? 0;
          if (aCount !== bCount) return aCount - bCount;
          return (hoursUsed.get(a.id) ?? 0) - (hoursUsed.get(b.id) ?? 0);
        });
      } else {
        sorted = [...available].sort(
          (a, b) => (hoursUsed.get(a.id) ?? 0) - (hoursUsed.get(b.id) ?? 0)
        );
      }

      let assigned = 0;

      for (const person of sorted) {
        // Check hourly max: would any hour this shift covers exceed the max?
        if (wouldExceedMax(coverage, startH, endH, constraints.maxPerShift)) break;

        resultShifts.push({
          personId: person.id,
          personName: person.name,
          date: dateStr,
          dayLabel,
          shiftName,
          startHour: startH,
          endHour: endH,
        });

        hoursUsed.set(person.id, (hoursUsed.get(person.id) ?? 0) + shiftHours);
        lastShiftEnd.set(person.id, absoluteEnd);
        assignedOnDate.add(`${person.id}:${dateStr}`);

        // Update coverage
        for (let h = startH; h < endH; h++) {
          coverage.set(h, (coverage.get(h) ?? 0) + 1);
        }

        currentDayAssignments.push({ personId: person.id, startH, endH });

        const personTypes = shiftTypeCounts.get(person.id)!;
        personTypes.set(shiftName, (personTypes.get(shiftName) ?? 0) + 1);

        assigned++;
      }
    }

    // After assigning all shifts for a day, validate hourly minimum coverage
    const currentDayAssignments = dayAssignments.get(dateStr)!;
    if (currentDayAssignments.length > 0) {
      const coverage = buildHourlyCoverage(currentDayAssignments);

      // Find the full hour range for this day
      let dayMinH = 24, dayMaxH = 0;
      for (const a of currentDayAssignments) {
        if (a.startH < dayMinH) dayMinH = a.startH;
        if (a.endH > dayMaxH) dayMaxH = a.endH;
      }

      const belowMin = hoursBelow(coverage, dayMinH, dayMaxH, constraints.minPerShift);
      if (belowMin.length > 0) {
        // Group consecutive hours for a cleaner warning
        const ranges: string[] = [];
        let rangeStart = belowMin[0];
        let rangeEnd = belowMin[0];
        for (let i = 1; i < belowMin.length; i++) {
          if (belowMin[i] === rangeEnd + 1) {
            rangeEnd = belowMin[i];
          } else {
            ranges.push(`${rangeStart}:00–${rangeEnd + 1}:00`);
            rangeStart = belowMin[i];
            rangeEnd = belowMin[i];
          }
        }
        ranges.push(`${rangeStart}:00–${rangeEnd + 1}:00`);

        warnings.push(
          `${dayLabel}: za mało osób (< ${constraints.minPerShift}) w godzinach ${ranges.join(', ')}`
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
