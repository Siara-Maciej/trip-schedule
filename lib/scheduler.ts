import type {
  ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap,
  NightShiftLimit, ScheduleConstraint,
} from '@/types/schedule';
import highs_loader from 'highs';

// Singleton HiGHS instance — loaded once, reused.
let highsInstance: Awaited<ReturnType<typeof highs_loader>> | null = null;

async function getHiGHS() {
  if (!highsInstance) {
    highsInstance = await highs_loader();
  }
  return highsInstance;
}

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

  function pushBlock(start: number, end: number) {
    let cur = start;
    while (cur < end) {
      const day = Math.floor((cur + offset) / 24) + 1;
      const dayEndSeq = day * 24 - offset;
      const blockEndInDay = Math.min(end, dayEndSeq);

      shifts.push({
        personId,
        personName,
        day,
        startHour: (cur + offset) % 24,
        endHour: (blockEndInDay + offset) % 24 || 24,
        type: 'WORK',
      });
      cur = blockEndInDay;
    }
  }

  let blockStart = hours[0];
  let blockEnd = hours[0] + 1;

  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === blockEnd) {
      blockEnd = hours[i] + 1;
    } else {
      pushBlock(blockStart, blockEnd);
      blockStart = hours[i];
      blockEnd = hours[i] + 1;
    }
  }
  pushBlock(blockStart, blockEnd);

  return shifts;
}

/** Variable name for person p starting a shift at sequential hour t */
function sVar(p: number, t: number): string {
  return `s${p}t${t}`;
}

/**
 * Builds a CPLEX LP format MIP using shift-start variables.
 *
 * Variables:
 *   s{p}t{t} ∈ {0,1} — person p starts a full S[p]-hour shift at seq hour t
 *   dPlus{p}, dMinus{p} ≥ 0 — deviation from target shift count
 *
 * A shift starting at t means person p works hours [t, t+S[p]-1].
 *
 * Constraints:
 *   1. Coverage: ∀h: Σ_{(p,t): t ≤ h < t+S[p]} s[p][t] ≥ 1
 *   2. Non-overlap + break: ∀p, ∀t: Σ_{t': t ≤ t' < t+S[p]+B[p]} s[p][t'] ≤ 1
 *   3. Night limit: ∀ night hour h: Σ_{(p,t): t ≤ h < t+S[p]} s[p][t] ≤ maxNight
 *   4. Daily cap: ∀p, ∀day: total work hours on that calendar day ≤ S[p]
 *   5. Target: numShifts[p] ≈ targetShifts[p]
 */
function buildLPModel(params: {
  peopleCount: number;
  totalHours: number;
  startHourOffset: number;
  shiftHours: number[];
  minBreaks: number[];
  constraints: ScheduleConstraint[];
  nightConstraint: NightShiftLimit | null;
  targetShifts: number[];
  blocked: boolean[][];
}): { lp: string; validStarts: number[][] } {
  const { peopleCount: N, totalHours: T, startHourOffset, shiftHours, minBreaks, nightConstraint, targetShifts, blocked } = params;

  // Compute valid shift start times per person
  const validStarts: number[][] = [];
  for (let p = 0; p < N; p++) {
    const starts: number[] = [];
    const S = shiftHours[p];
    for (let t = 0; t + S <= T; t++) {
      let valid = true;
      for (let h = t; h < t + S; h++) {
        if (blocked[p][h]) { valid = false; break; }
      }
      if (valid) starts.push(t);
    }
    validStarts.push(starts);
  }

  const lines: string[] = [];

  // Objective: minimize total deviation from target shifts
  lines.push('Minimize');
  const objTerms: string[] = [];
  for (let p = 0; p < N; p++) {
    objTerms.push(`dPlus${p}`, `dMinus${p}`);
  }
  lines.push(` obj: ${objTerms.join(' + ')}`);

  lines.push('Subject To');
  let cIdx = 0;

  // 1. Coverage: every hour must have at least 1 person working
  for (let h = 0; h < T; h++) {
    const terms: string[] = [];
    for (let p = 0; p < N; p++) {
      const S = shiftHours[p];
      for (const t of validStarts[p]) {
        if (t <= h && h < t + S) {
          terms.push(sVar(p, t));
        }
      }
    }
    if (terms.length > 0) {
      lines.push(` c${cIdx++}: ${terms.join(' + ')} >= 1`);
    }
    // If no terms, hour is uncoverable — detected after solving
  }

  // 2. Non-overlap + mandatory break: for each person, in any window of (S+B) hours,
  //    at most 1 shift can start
  for (let p = 0; p < N; p++) {
    const cycle = shiftHours[p] + minBreaks[p];
    // For each starting position of the window
    for (let wStart = 0; wStart < T; wStart++) {
      const wEnd = Math.min(wStart + cycle, T);
      const terms: string[] = [];
      for (const t of validStarts[p]) {
        if (t >= wStart && t < wEnd) {
          terms.push(sVar(p, t));
        }
      }
      if (terms.length > 1) {
        lines.push(` c${cIdx++}: ${terms.join(' + ')} <= 1`);
      }
    }
  }

  // 3. Night limit
  if (nightConstraint) {
    for (let h = 0; h < T; h++) {
      const clockHour = (h + startHourOffset) % 24;
      if (isHourInRange(clockHour, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
        const terms: string[] = [];
        for (let p = 0; p < N; p++) {
          const S = shiftHours[p];
          for (const t of validStarts[p]) {
            if (t <= h && h < t + S) {
              terms.push(sVar(p, t));
            }
          }
        }
        if (terms.length > 0) {
          lines.push(` c${cIdx++}: ${terms.join(' + ')} <= ${nightConstraint.maxPeople}`);
        }
      }
    }
  }

  // 4. Daily cap: each person works at most S[p] hours per calendar day
  const totalDays = Math.ceil((startHourOffset + T) / 24);
  for (let p = 0; p < N; p++) {
    const S = shiftHours[p];
    for (let d = 1; d <= totalDays; d++) {
      // Calendar day d covers sequential hours where floor((h + offset) / 24) + 1 == d
      const daySeqStart = Math.max(0, (d - 1) * 24 - startHourOffset);
      const daySeqEnd = Math.min(T, d * 24 - startHourOffset);
      if (daySeqStart >= daySeqEnd) continue;

      const terms: string[] = [];
      const coeffs: number[] = [];
      for (const t of validStarts[p]) {
        // Shift [t, t+S) — how many hours fall in [daySeqStart, daySeqEnd)?
        const overlapStart = Math.max(t, daySeqStart);
        const overlapEnd = Math.min(t + S, daySeqEnd);
        const overlap = overlapEnd - overlapStart;
        if (overlap > 0) {
          if (overlap === 1) {
            terms.push(sVar(p, t));
          } else {
            terms.push(`${overlap} ${sVar(p, t)}`);
          }
          coeffs.push(overlap);
        }
      }
      if (terms.length > 0) {
        lines.push(` c${cIdx++}: ${terms.join(' + ')} <= ${S}`);
      }
    }
  }

  // 5. Target shift deviation
  for (let p = 0; p < N; p++) {
    if (validStarts[p].length === 0) continue;
    const terms = validStarts[p].map(t => sVar(p, t));
    // numShifts - dPlus <= targetShifts
    lines.push(` c${cIdx++}: ${terms.join(' + ')} - dPlus${p} <= ${targetShifts[p]}`);
    // -numShifts - dMinus <= -targetShifts
    lines.push(` c${cIdx++}: - ${terms.join(' - ')} - dMinus${p} <= ${-targetShifts[p]}`);
  }

  // Bounds
  lines.push('Bounds');
  for (let p = 0; p < N; p++) {
    lines.push(` 0 <= dPlus${p}`);
    lines.push(` 0 <= dMinus${p}`);
    for (const t of validStarts[p]) {
      lines.push(` 0 <= ${sVar(p, t)} <= 1`);
    }
  }

  // Integer variables
  lines.push('General');
  const intVars: string[] = [];
  for (let p = 0; p < N; p++) {
    for (const t of validStarts[p]) {
      intVars.push(sVar(p, t));
    }
  }
  if (intVars.length > 0) {
    lines.push(` ${intVars.join(' ')}`);
  }

  lines.push('End');
  return { lp: lines.join('\n'), validStarts };
}

/**
 * Generuje harmonogram pracy z granulacją 1-godzinną używając solvera MIP (HiGHS).
 *
 * Model: zmienne binarne s[p][t] = "osoba p zaczyna zmianę o godzinie t".
 * Każda zmiana trwa dokładnie S godzin, po niej obowiązkowa przerwa B godzin.
 *
 * Gwarantuje:
 * - Optymalne rozwiązanie (lub informację o niemożliwości)
 * - Pełne pokrycie (zawsze ktoś pracuje)
 * - Sprawiedliwy rozkład godzin
 * - Respektowanie wszystkich ograniczeń
 */
export async function generateSchedule(params: ScheduleParams): Promise<ScheduleResult> {
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

  // Precompute blocked[p][t]
  const blocked: boolean[][] = Array.from({ length: peopleCount }, (_, p) =>
    Array.from({ length: totalHours }, (__, t) => {
      const clockHour = (t + startHourOffset) % 24;
      return isPersonBlockedForHour(p, clockHour, constraints);
    })
  );

  // Pre-check: detect hours that no shift can cover (all people blocked)
  for (let h = 0; h < totalHours; h++) {
    const clockHour = (h + startHourOffset) % 24;
    let canBeCovered = false;
    for (let p = 0; p < peopleCount; p++) {
      const S = shiftHours[p];
      // Check if any shift containing seq hour h is valid for person p
      for (let t = Math.max(0, h - S + 1); t <= h && t + S <= totalHours; t++) {
        let valid = true;
        for (let hh = t; hh < t + S; hh++) {
          if (blocked[p][hh]) { valid = false; break; }
        }
        if (valid) { canBeCovered = true; break; }
      }
      if (canBeCovered) break;
    }
    if (!canBeCovered) {
      const isNight = nightConstraint && isHourInRange(clockHour, nightConstraint.nightStartHour, nightConstraint.nightEndHour);
      if (isNight) {
        errors.push(
          `Godzina ${clockHour}:00 nie może być pokryta — żadna osoba nie może pracować w nocy. ` +
          `Oznacz przynajmniej 1 osobę jako \"może pracować w nocy\".`
        );
      } else {
        errors.push(
          `Godzina ${clockHour}:00 nie może być pokryta — wszyscy są zablokowani.`
        );
      }
      // Return early with clear error
      return {
        shifts: [], valid: false, errors: [...new Set(errors)], coverageGaps: [],
        stats: personNames.map((name, i) => ({
          personId: i, personName: name, totalWorkHours: 0, shiftsCount: 0, minBreakActual: 0,
        })),
      };
    }
  }

  // Target shifts per person: full cycles
  const targetShifts = shiftHours.map((s, i) => {
    const cycle = s + minBreaks[i];
    return Math.floor(totalHours / cycle);
  });

  // Build and solve MIP
  const { lp: lpModel, validStarts } = buildLPModel({
    peopleCount,
    totalHours,
    startHourOffset,
    shiftHours,
    minBreaks,
    constraints,
    nightConstraint,
    targetShifts,
    blocked,
  });

  const highs = await getHiGHS();
  const solution = highs.solve(lpModel, { time_limit: 10 });

  if (solution.Status === 'Infeasible') {
    errors.push('Harmonogram jest niemożliwy do ułożenia przy zadanych ograniczeniach.');
    return { shifts: [], valid: false, errors, coverageGaps: [], stats: personNames.map((name, i) => ({
      personId: i, personName: name, totalWorkHours: 0, shiftsCount: 0, minBreakActual: 0,
    }))};
  }

  if (solution.Status !== 'Optimal') {
    errors.push(`Solver zwrócił status: ${solution.Status}. Harmonogram może być niepełny.`);
  }

  // Extract solution: work hours per person from shift starts
  const workHoursByPerson: number[][] = Array.from({ length: peopleCount }, () => []);
  const totalWorkHoursArr: number[] = new Array(peopleCount).fill(0);

  for (let p = 0; p < peopleCount; p++) {
    const S = shiftHours[p];
    for (const t of validStarts[p]) {
      const col = solution.Columns[sVar(p, t)];
      if (col && col.Primal > 0.5) {
        for (let h = t; h < t + S; h++) {
          workHoursByPerson[p].push(h);
          totalWorkHoursArr[p]++;
        }
      }
    }
  }

  // Check coverage gaps
  for (let h = 0; h < totalHours; h++) {
    let covered = false;
    for (let p = 0; p < peopleCount; p++) {
      if (workHoursByPerson[p].includes(h)) {
        covered = true;
        break;
      }
    }
    if (!covered) {
      const day = Math.floor((h + startHourOffset) / 24) + 1;
      const clockHour = (h + startHourOffset) % 24;
      coverageGaps.push({ day, startHour: clockHour, endHour: clockHour + 1 });
    }
  }

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
