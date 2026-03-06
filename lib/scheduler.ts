import type {
  ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap,
  NightShiftLimit, ScheduleConstraint,
} from '@/types/schedule';

function isHourInRange(hour: number, rangeStart: number, rangeEnd: number): boolean {
  if (rangeStart < rangeEnd) {
    return hour >= rangeStart && hour < rangeEnd;
  }
  return hour >= rangeStart || hour < rangeEnd;
}

function isPersonBlockedForHour(
  personId: number,
  hour: number,
  constraints: ScheduleConstraint[],
): boolean {
  for (const c of constraints) {
    if (c.type === 'personBlocked' && c.personId === personId) {
      if (isHourInRange(hour, c.startHour, c.endHour)) {
        return true;
      }
    }
  }
  return false;
}

function mergeHoursIntoShifts(
  personId: number,
  personName: string,
  hours: number[],
  offset: number,
): Shift[] {
  if (hours.length === 0) return [];
  const shifts: Shift[] = [];

  let blockStart = hours[0];
  let blockEnd = hours[0] + 1;

  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === blockEnd) {
      blockEnd = hours[i] + 1;
    } else {
      const day = Math.floor((blockStart + offset) / 24) + 1;
      shifts.push({
        personId,
        personName,
        day,
        startHour: (blockStart + offset) % 24,
        endHour: (blockEnd + offset) % 24 || 24,
        type: 'WORK',
      });
      blockStart = hours[i];
      blockEnd = hours[i] + 1;
    }
  }

  const day = Math.floor((blockStart + offset) / 24) + 1;
  shifts.push({
    personId,
    personName,
    day,
    startHour: (blockStart + offset) % 24,
    endHour: (blockEnd + offset) % 24 || 24,
    type: 'WORK',
  });

  return shifts;
}

/**
 * Generuje harmonogram pracy z granulacją 1-godzinną.
 * Respektuje startHourOffset — harmonogram zaczyna się od podanej godziny,
 * nie od północy. Łączna liczba godzin to totalHours.
 *
 * Cykl pracy: pracuj shiftHours godzin, potem obowiązkowa przerwa minBreakHours,
 * potem pracuj znowu. Limit jest per zmianę, nie per dzień kalendarzowy.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const {
    peopleCount,
    totalHours,
    startHourOffset = 0,
    names = [],
    perPersonShiftHours = [],
    perPersonMinBreak = [],
    constraints = [],
  } = params;

  const errors: string[] = [];
  const coverageGaps: TimeGap[] = [];

  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  const shiftHours = Array.from({ length: peopleCount }, (_, i) => perPersonShiftHours[i] ?? 8);
  const minBreaks = Array.from({ length: peopleCount }, (_, i) => perPersonMinBreak[i] ?? 11);

  const nightConstraint = constraints.find((c): c is NightShiftLimit => c.type === 'nightShiftLimit') ?? null;

  // Per-person state: shift/break cycle tracking
  const hoursWorkedSinceBreak: number[] = new Array(peopleCount).fill(0);
  const lastWorkEnd: number[] = new Array(peopleCount).fill(-Infinity);
  const totalWorkHoursArr: number[] = new Array(peopleCount).fill(0);

  const workHoursByPerson: number[][] = Array.from({ length: peopleCount }, () => []);
  const hourAssignments = new Map<number, Set<number>>();

  function getCalendarDay(seqHour: number): number {
    return Math.floor((seqHour + startHourOffset) / 24) + 1;
  }

  function getClockHour(seqHour: number): number {
    return (seqHour + startHourOffset) % 24;
  }

  function canPersonWorkHour(p: number, seqHour: number): boolean {
    const clockHour = getClockHour(seqHour);
    const personShift = shiftHours[p];
    const personBreak = minBreaks[p];

    if (isPersonBlockedForHour(p, clockHour, constraints)) return false;

    // Shift/break cycle: after working shiftHours, must rest minBreakHours
    if (lastWorkEnd[p] !== -Infinity) {
      const gap = seqHour - lastWorkEnd[p];
      if (gap < personBreak && hoursWorkedSinceBreak[p] >= personShift) {
        return false;
      }
    }

    // Night constraint
    if (nightConstraint && isHourInRange(clockHour, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
      const assigned = hourAssignments.get(seqHour);
      if (assigned && assigned.size >= nightConstraint.maxPeople) return false;
    }

    return true;
  }

  function assignWork(p: number, seqHour: number) {
    const personBreak = minBreaks[p];
    if (lastWorkEnd[p] !== -Infinity) {
      const gap = seqHour - lastWorkEnd[p];
      if (gap >= personBreak) {
        hoursWorkedSinceBreak[p] = 0;
      }
    } else {
      hoursWorkedSinceBreak[p] = 0;
    }

    hoursWorkedSinceBreak[p]++;
    lastWorkEnd[p] = seqHour + 1;
    totalWorkHoursArr[p]++;
    workHoursByPerson[p].push(seqHour);

    if (!hourAssignments.has(seqHour)) {
      hourAssignments.set(seqHour, new Set());
    }
    hourAssignments.get(seqHour)!.add(p);
  }

  // Main loop: iterate exactly totalHours sequential hours
  for (let seqHour = 0; seqHour < totalHours; seqHour++) {
    const available: number[] = [];
    for (let p = 0; p < peopleCount; p++) {
      if (canPersonWorkHour(p, seqHour)) {
        available.push(p);
      }
    }

    // Calculate target workers: estimate total remaining work across the schedule
    const remainingScheduleHours = Math.max(1, totalHours - seqHour);
    let totalRemainingWork = 0;
    for (let p = 0; p < peopleCount; p++) {
      const currentShiftRemaining = Math.max(0, shiftHours[p] - hoursWorkedSinceBreak[p]);
      const timeAfterCurrent = Math.max(0, remainingScheduleHours - currentShiftRemaining);
      const cycleLen = shiftHours[p] + minBreaks[p];
      const futureCycles = cycleLen > 0 ? Math.floor(timeAfterCurrent / cycleLen) : 0;
      const futureWork = futureCycles * shiftHours[p];
      const leftover = timeAfterCurrent - futureCycles * cycleLen;
      const leftoverWork = leftover > minBreaks[p]
        ? Math.min(leftover - minBreaks[p], shiftHours[p])
        : 0;
      totalRemainingWork += currentShiftRemaining + futureWork + leftoverWork;
    }
    const targetThisHour = Math.max(1, Math.ceil(totalRemainingWork / remainingScheduleHours));

    if (available.length === 0) {
      const assigned = hourAssignments.get(seqHour);
      if (!assigned || assigned.size === 0) {
        const day = getCalendarDay(seqHour);
        coverageGaps.push({ day, startHour: getClockHour(seqHour), endHour: getClockHour(seqHour) + 1 });
      }
      continue;
    }

    available.sort((a, b) => {
      // 1. Continue current work block (shift continuity)
      const aInBlock = lastWorkEnd[a] === seqHour;
      const bInBlock = lastWorkEnd[b] === seqHour;
      if (aInBlock !== bInBlock) return aInBlock ? -1 : 1;

      // 2. Prefer person with more remaining capacity in current shift
      const aRemaining = shiftHours[a] - hoursWorkedSinceBreak[a];
      const bRemaining = shiftHours[b] - hoursWorkedSinceBreak[b];
      if (aRemaining !== bRemaining) return bRemaining - aRemaining;

      // 3. Balance total hours across people
      return totalWorkHoursArr[a] - totalWorkHoursArr[b];
    });

    const toAssign = Math.min(targetThisHour, available.length);
    for (let i = 0; i < toAssign; i++) {
      const p = available[i];
      const clockHour = getClockHour(seqHour);

      if (nightConstraint && isHourInRange(clockHour, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
        const assigned = hourAssignments.get(seqHour);
        if (assigned && assigned.size >= nightConstraint.maxPeople) break;
      }

      assignWork(p, seqHour);
    }
  }

  // Check coverage
  for (let seqHour = 0; seqHour < totalHours; seqHour++) {
    const assigned = hourAssignments.get(seqHour);
    if (!assigned || assigned.size === 0) {
      const day = getCalendarDay(seqHour);
      const clockHour = getClockHour(seqHour);
      const alreadyGap = coverageGaps.some(
        (g) => g.day === day && g.startHour === clockHour
      );
      if (!alreadyGap) {
        coverageGaps.push({ day, startHour: clockHour, endHour: clockHour + 1 });
      }
    }
  }

  // Post-processing: generate errors for coverage gaps
  if (coverageGaps.length > 0) {
    errors.push(
      `Brak pokrycia w ${coverageGaps.length} godzinach — za malo osob lub zbyt dlugie przerwy.`
    );
  }

  // Merge hours into shifts
  const shifts: Shift[] = [];
  for (let p = 0; p < peopleCount; p++) {
    workHoursByPerson[p].sort((a, b) => a - b);
    shifts.push(...mergeHoursIntoShifts(p, personNames[p], workHoursByPerson[p], startHourOffset));
  }

  // Stats
  const stats: PersonStats[] = personNames.map((name, i) => {
    const personShifts = shifts.filter((s) => s.personId === i);
    let minBreak = Infinity;
    const sortedShifts = [...personShifts].sort((a, b) => {
      const absA = (a.day - 1) * 24 + a.startHour;
      const absB = (b.day - 1) * 24 + b.startHour;
      return absA - absB;
    });
    for (let s = 0; s < sortedShifts.length - 1; s++) {
      const endAbs = (sortedShifts[s].day - 1) * 24 + sortedShifts[s].endHour;
      const startAbs = (sortedShifts[s + 1].day - 1) * 24 + sortedShifts[s + 1].startHour;
      const gap = startAbs - endAbs;
      if (gap > 0 && gap < minBreak) minBreak = gap;
    }

    return {
      personId: i,
      personName: name,
      totalWorkHours: totalWorkHoursArr[i],
      shiftsCount: personShifts.length,
      minBreakActual: minBreak === Infinity ? 0 : minBreak,
    };
  });

  const valid = coverageGaps.length === 0 && errors.length === 0;

  return { shifts, valid, errors, coverageGaps, stats };
}
