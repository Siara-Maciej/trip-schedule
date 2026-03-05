import type {
  ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap,
  NightShiftLimit, ScheduleConstraint,
} from '@/types/schedule';

// Sprawdź czy godzina mieści się w zakresie (obsługuje przejście przez północ)
function isHourInRange(hour: number, rangeStart: number, rangeEnd: number): boolean {
  if (rangeStart < rangeEnd) {
    return hour >= rangeStart && hour < rangeEnd;
  }
  // Zakres przez północ (np. 22-6)
  return hour >= rangeStart || hour < rangeEnd;
}

// Sprawdź czy osoba jest zablokowana dla danej godziny
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

// Łączy posortowaną listę godzin w ciągłe bloki (Shift)
function mergeHoursIntoShifts(
  personId: number,
  personName: string,
  hours: number[], // absolutne godziny, posortowane rosnąco
): Shift[] {
  if (hours.length === 0) return [];
  const shifts: Shift[] = [];

  let blockStart = hours[0];
  let blockEnd = hours[0] + 1;

  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === blockEnd) {
      blockEnd = hours[i] + 1;
    } else {
      const day = Math.floor(blockStart / 24) + 1;
      shifts.push({
        personId,
        personName,
        day,
        startHour: blockStart % 24,
        endHour: blockEnd % 24 || 24,
        type: 'WORK',
      });
      blockStart = hours[i];
      blockEnd = hours[i] + 1;
    }
  }

  const day = Math.floor(blockStart / 24) + 1;
  shifts.push({
    personId,
    personName,
    day,
    startHour: blockStart % 24,
    endHour: blockEnd % 24 || 24,
    type: 'WORK',
  });

  return shifts;
}

/**
 * Generuje harmonogram pracy z granulacją 1-godzinną.
 * Wspiera per-person hoursPerShift i minBreakHours.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const {
    peopleCount,
    totalHours,
    names = [],
    perPersonShiftHours = [],
    perPersonMinBreak = [],
    constraints = [],
  } = params;

  const durationDays = Math.ceil(totalHours / 24);

  const errors: string[] = [];
  const coverageGaps: TimeGap[] = [];

  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  // Per-person params with defaults
  const shiftHours = Array.from({ length: peopleCount }, (_, i) => perPersonShiftHours[i] ?? 8);
  const minBreaks = Array.from({ length: peopleCount }, (_, i) => perPersonMinBreak[i] ?? 11);

  // Constraint nocny
  const nightConstraint = constraints.find((c): c is NightShiftLimit => c.type === 'nightShiftLimit') ?? null;

  // Stan per osoba
  const hoursWorkedSinceBreak: number[] = new Array(peopleCount).fill(0);
  const lastWorkEnd: number[] = new Array(peopleCount).fill(-Infinity);
  const totalWorkHours: number[] = new Array(peopleCount).fill(0);

  const workHoursByPerson: number[][] = Array.from({ length: peopleCount }, () => []);
  const hourAssignments = new Map<number, Set<number>>();

  function canPersonWorkHour(p: number, absoluteHour: number, hoursWorkedToday: number): boolean {
    const hour = absoluteHour % 24;
    const personShift = shiftHours[p];
    const personBreak = minBreaks[p];

    if (hoursWorkedToday >= personShift) return false;

    if (isPersonBlockedForHour(p, hour, constraints)) return false;

    if (lastWorkEnd[p] !== -Infinity) {
      const gap = absoluteHour - lastWorkEnd[p];

      if (gap >= personBreak) {
        // OK — natural break
      } else if (hoursWorkedSinceBreak[p] >= personShift) {
        return false;
      }
    }

    if (nightConstraint && isHourInRange(hour, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
      const assigned = hourAssignments.get(absoluteHour);
      const currentNightPeople = assigned ? assigned.size : 0;
      if (currentNightPeople >= nightConstraint.maxPeople) return false;
    }

    return true;
  }

  function assignWork(p: number, absoluteHour: number) {
    const personBreak = minBreaks[p];
    if (lastWorkEnd[p] !== -Infinity) {
      const gap = absoluteHour - lastWorkEnd[p];
      if (gap >= personBreak) {
        hoursWorkedSinceBreak[p] = 0;
      }
    } else {
      hoursWorkedSinceBreak[p] = 0;
    }

    hoursWorkedSinceBreak[p]++;
    lastWorkEnd[p] = absoluteHour + 1;
    totalWorkHours[p]++;
    workHoursByPerson[p].push(absoluteHour);

    if (!hourAssignments.has(absoluteHour)) {
      hourAssignments.set(absoluteHour, new Set());
    }
    hourAssignments.get(absoluteHour)!.add(p);
  }

  for (let day = 1; day <= durationDays; day++) {
    const hoursWorkedToday: number[] = new Array(peopleCount).fill(0);
    const workedToday: boolean[] = new Array(peopleCount).fill(false);

    for (let hour = 0; hour < 24; hour++) {
      const absoluteHour = (day - 1) * 24 + hour;

      const available: number[] = [];
      for (let p = 0; p < peopleCount; p++) {
        if (canPersonWorkHour(p, absoluteHour, hoursWorkedToday[p])) {
          available.push(p);
        }
      }

      // Ile osób powinno pracować tę godzinę?
      let remainingPersonHours = 0;
      for (let p = 0; p < peopleCount; p++) {
        remainingPersonHours += Math.max(0, shiftHours[p] - hoursWorkedToday[p]);
      }
      const remainingDayHours = 24 - hour;
      const targetThisHour = Math.max(1, Math.ceil(remainingPersonHours / remainingDayHours));

      if (available.length === 0) {
        const assigned = hourAssignments.get(absoluteHour);
        if (!assigned || assigned.size === 0) {
          coverageGaps.push({ day, startHour: hour, endHour: hour + 1 });
        }
        continue;
      }

      available.sort((a, b) => {
        const aInBlock = lastWorkEnd[a] === absoluteHour;
        const bInBlock = lastWorkEnd[b] === absoluteHour;
        if (aInBlock !== bInBlock) return aInBlock ? -1 : 1;

        if (workedToday[a] !== workedToday[b]) return workedToday[a] ? 1 : -1;

        if (hoursWorkedToday[a] !== hoursWorkedToday[b]) return hoursWorkedToday[a] - hoursWorkedToday[b];

        return totalWorkHours[a] - totalWorkHours[b];
      });

      const toAssign = Math.min(targetThisHour, available.length);
      for (let i = 0; i < toAssign; i++) {
        const p = available[i];

        const hourMod = absoluteHour % 24;
        if (nightConstraint && isHourInRange(hourMod, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
          const assigned = hourAssignments.get(absoluteHour);
          if (assigned && assigned.size >= nightConstraint.maxPeople) break;
        }

        assignWork(p, absoluteHour);
        hoursWorkedToday[p]++;
        workedToday[p] = true;
      }
    }

    for (let p = 0; p < peopleCount; p++) {
      if (!workedToday[p]) {
        errors.push(
          `${personNames[p]} nie ma przydzielonej pracy w dniu ${day} — brak dostępnych godzin (przerwa/ograniczenia).`
        );
      }
    }
  }

  // Sprawdź pokrycie
  for (let day = 1; day <= durationDays; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const absoluteHour = (day - 1) * 24 + hour;
      const assigned = hourAssignments.get(absoluteHour);
      if (!assigned || assigned.size === 0) {
        const alreadyGap = coverageGaps.some(
          (g) => g.day === day && g.startHour === hour
        );
        if (!alreadyGap) {
          coverageGaps.push({ day, startHour: hour, endHour: hour + 1 });
        }
      }
    }
  }

  // Scal godziny w ciągłe zmiany
  const shifts: Shift[] = [];
  for (let p = 0; p < peopleCount; p++) {
    workHoursByPerson[p].sort((a, b) => a - b);
    shifts.push(...mergeHoursIntoShifts(p, personNames[p], workHoursByPerson[p]));
  }

  // Statystyki
  const stats: PersonStats[] = personNames.map((name, i) => {
    const personShifts = shifts.filter((s) => s.personId === i);
    let minBreak = Infinity;
    const sortedShifts = personShifts.sort((a, b) => {
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
      totalWorkHours: totalWorkHours[i],
      shiftsCount: personShifts.length,
      minBreakActual: minBreak === Infinity ? 0 : minBreak,
    };
  });

  const valid = coverageGaps.length === 0 && errors.length === 0;

  return { shifts, valid, errors, coverageGaps, stats };
}
