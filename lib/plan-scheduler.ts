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

function getShiftsForDay(
  wh: WorkingHoursConfig,
  dayOfWeekMon: number,
): ShiftDefinition[] {
  switch (wh.type) {
    case 'continuous':
      return [{ name: 'Zmiana', startTime: '00:00', endTime: '24:00', required: true, minPerPersonInPeriod: 0 }];
    case 'fixed':
      return [{ name: 'Zmiana', startTime: wh.startTime, endTime: wh.endTime, required: true, minPerPersonInPeriod: 0 }];
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

// ── Scoring helpers ──────────────────────────────────────

interface DaySlot {
  shift: ShiftDefinition;
  startH: number;
  endH: number;
  shiftHours: number;
  assigned: Person[];
}

/**
 * Score a candidate for a particular shift slot.
 * Lower = better candidate.
 *
 * With fairDistribution:
 *   1. Prefer person who has done THIS shift type least
 *   2. Break ties by total hours used (least first)
 *
 * Without fairDistribution:
 *   1. Sort by least total hours used
 */
function candidateScore(
  person: Person,
  shiftName: string,
  shiftTypeCounts: Map<string, Map<string, number>>,
  hoursUsed: Map<string, number>,
  fairDistribution: boolean,
): [number, number] {
  const typeCount = shiftTypeCounts.get(person.id)?.get(shiftName) ?? 0;
  const hours = hoursUsed.get(person.id) ?? 0;
  if (fairDistribution) {
    return [typeCount, hours];
  }
  return [hours, typeCount];
}

function compareCandidates(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

/**
 * Main scheduler — interleaved round-robin for required shifts,
 * then optional shifts for quota fulfilment.
 *
 * Key improvement: instead of filling shifts sequentially (which puts
 * everyone on shift 1 when oneShiftPerDay is on), we distribute people
 * across ALL required shifts simultaneously using round-robin.
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

  // ── Tracking state ──
  const hoursUsed = new Map<string, number>();
  for (const p of people) hoursUsed.set(p.id, 0);

  const lastShiftEnd = new Map<string, number>();

  // personId → Map<shiftName, count>
  const shiftTypeCounts = new Map<string, Map<string, number>>();
  for (const p of people) shiftTypeCounts.set(p.id, new Map());

  const resultShifts: PlanShift[] = [];
  const totalWeeks = Math.max(1, Math.ceil(dates.length / 7));
  const periodStartTime = dates[0].getTime();

  // ── Per-day scheduling ──
  for (const date of dates) {
    const dowMon = jsDowToMon(date.getDay());
    const dayShifts = getShiftsForDay(workingHours, dowMon);
    if (dayShifts.length === 0) continue;

    const dayLabel = `${DAY_LABELS[date.getDay()]} ${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`;
    const dateStr = date.toISOString().slice(0, 10);
    const dayOffsetHours = (date.getTime() - periodStartTime) / (1000 * 60 * 60);

    // People assigned on this day (for oneShiftPerDay tracking)
    const assignedToday = new Set<string>();

    // Build slots
    const requiredSlots: DaySlot[] = [];
    const optionalSlots: DaySlot[] = [];

    for (const shift of dayShifts) {
      const startH = parseHour(shift.startTime);
      const endH = shift.endTime === '24:00' ? 24 : parseHour(shift.endTime);
      const shiftHours = endH - startH;
      if (shiftHours <= 0) continue;

      const slot: DaySlot = { shift, startH, endH, shiftHours, assigned: [] };
      const isRequired = shift.required ?? true;
      if (isRequired) {
        requiredSlots.push(slot);
      } else {
        optionalSlots.push(slot);
      }
    }

    // ── Helper: check if a person can work a given slot ──
    const canWork = (person: Person, slot: DaySlot): boolean => {
      if (person.unavailableDays.includes(dowMon)) return false;

      // One shift per day
      if (oneShiftPerDay && assignedToday.has(person.id)) return false;

      // Time overlap check (when multiple shifts per day allowed)
      if (!oneShiftPerDay) {
        for (const rs of [...requiredSlots, ...optionalSlots]) {
          if (rs.assigned.some((p) => p.id === person.id)) {
            if (slot.startH < rs.endH && slot.endH > rs.startH) return false;
          }
        }
      }

      // Rest period from previous day
      const absoluteStart = dayOffsetHours + slot.startH;
      const lastEnd = lastShiftEnd.get(person.id);
      if (lastEnd !== undefined && absoluteStart - lastEnd < MIN_REST_HOURS) return false;

      // Weekly hours limit
      const used = hoursUsed.get(person.id) ?? 0;
      if (used + slot.shiftHours > person.weeklyHours * totalWeeks) return false;

      return true;
    };

    // ── Helper: assign a person to a slot ──
    const assignPerson = (person: Person, slot: DaySlot) => {
      slot.assigned.push(person);
      assignedToday.add(person.id);
      hoursUsed.set(person.id, (hoursUsed.get(person.id) ?? 0) + slot.shiftHours);
      lastShiftEnd.set(person.id, dayOffsetHours + slot.endH);

      const personTypes = shiftTypeCounts.get(person.id)!;
      personTypes.set(slot.shift.name, (personTypes.get(slot.shift.name) ?? 0) + 1);

      resultShifts.push({
        personId: person.id,
        personName: person.name,
        date: dateStr,
        dayLabel,
        shiftName: slot.shift.name,
        startHour: slot.startH,
        endHour: slot.endH,
      });
    };

    // ── Helper: pick best candidate for a slot from a list of people ──
    const pickBest = (candidates: Person[], slot: DaySlot): Person | null => {
      let best: Person | null = null;
      let bestScore: [number, number] = [Infinity, Infinity];

      for (const p of candidates) {
        if (!canWork(p, slot)) continue;
        const score = candidateScore(p, slot.shift.name, shiftTypeCounts, hoursUsed, fairDistribution);
        if (compareCandidates(score, bestScore) < 0) {
          best = p;
          bestScore = score;
        }
      }

      return best;
    };

    // ══════════════════════════════════════════════════════
    // PHASE 1: Fill required shifts — interleaved round-robin
    //
    // Instead of filling shift 1 then shift 2 (which starves shift 2),
    // we repeatedly pick the shift with fewest assigned and add 1 person.
    // This guarantees even distribution: min(2) across 3 shifts with 6 people → 2-2-2.
    // ══════════════════════════════════════════════════════

    if (requiredSlots.length > 0) {
      // Phase 1a: Fill all required shifts to minPerShift (interleaved)
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;

        // Sort slots: fewest assigned first (fill the neediest shift next)
        const needySlots = requiredSlots
          .filter((s) => s.assigned.length < constraints.minPerShift)
          .sort((a, b) => a.assigned.length - b.assigned.length);

        if (needySlots.length === 0) break;

        // Try to assign ONE person to the neediest slot
        const slot = needySlots[0];
        const availablePeople = people.filter((p) => canWork(p, slot));
        const best = pickBest(availablePeople, slot);

        if (best) {
          assignPerson(best, slot);
          madeProgress = true;
        } else {
          // Can't fill this slot's minimum — emit warning and try next
          // Remove it from the "needy" pool so we don't loop
          // Mark it by setting a flag (we'll warn after the loop)
          break;
        }
      }

      // Phase 1b: Fill required shifts up to maxPerShift (also interleaved)
      madeProgress = true;
      while (madeProgress) {
        madeProgress = false;

        const fillableSlots = requiredSlots
          .filter((s) => s.assigned.length < constraints.maxPerShift)
          .sort((a, b) => a.assigned.length - b.assigned.length);

        if (fillableSlots.length === 0) break;

        const slot = fillableSlots[0];
        const best = pickBest(people, slot);

        if (best) {
          assignPerson(best, slot);
          madeProgress = true;
        } else {
          break;
        }
      }

      // Warnings for under-staffed required shifts
      for (const slot of requiredSlots) {
        if (slot.assigned.length < constraints.minPerShift) {
          warnings.push(
            `${dayLabel}, ${slot.shift.name}: przypisano ${slot.assigned.length}/${constraints.minPerShift} wymaganych`,
          );
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // PHASE 2: Optional shifts
    //
    // Assign people who still need more of this shift type
    // (minPerPersonInPeriod quota) or as fallback for coverage.
    // ══════════════════════════════════════════════════════

    for (const slot of optionalSlots) {
      const minPerPerson = slot.shift.minPerPersonInPeriod ?? 0;

      // Sort candidates by who needs this shift most (quota deficit)
      const candidates = people
        .filter((p) => canWork(p, slot))
        .map((p) => {
          const done = shiftTypeCounts.get(p.id)?.get(slot.shift.name) ?? 0;
          const deficit = minPerPerson - done; // positive = needs more
          return { person: p, deficit, done };
        })
        .filter((c) => {
          // If quota is 0, only assign if somehow needed (we skip for now)
          if (minPerPerson === 0) return false;
          // Only assign if person still has quota to fill
          return c.deficit > 0;
        })
        .sort((a, b) => {
          // Most deficit first
          if (a.deficit !== b.deficit) return b.deficit - a.deficit;
          // Then least hours
          return (hoursUsed.get(a.person.id) ?? 0) - (hoursUsed.get(b.person.id) ?? 0);
        });

      let assigned = 0;
      for (const c of candidates) {
        if (assigned >= constraints.maxPerShift) break;
        assignPerson(c.person, slot);
        assigned++;
      }
    }
  }

  // ── Post-scheduling: check optional shift quotas ──
  for (const shift of getAllShifts(workingHours)) {
    const isRequired = shift.required ?? true;
    const minPerPerson = shift.minPerPersonInPeriod ?? 0;
    if (isRequired || minPerPerson === 0) continue;

    for (const person of people) {
      const done = shiftTypeCounts.get(person.id)?.get(shift.name) ?? 0;
      if (done < minPerPerson) {
        warnings.push(
          `${person.name}: ${shift.name} przypisana ${done}/${minPerPerson} razy (limit w okresie)`,
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

/** Helper: get all unique shift definitions from a working hours config. */
function getAllShifts(wh: WorkingHoursConfig): ShiftDefinition[] {
  switch (wh.type) {
    case 'continuous':
      return [{ name: 'Zmiana', startTime: '00:00', endTime: '24:00', required: true, minPerPersonInPeriod: 0 }];
    case 'fixed':
      return [{ name: 'Zmiana', startTime: wh.startTime, endTime: wh.endTime, required: true, minPerPersonInPeriod: 0 }];
    case 'shifts':
      return wh.shifts;
    case 'custom': {
      // Deduplicate by shift name
      const map = new Map<string, ShiftDefinition>();
      for (const dayConfig of Object.values(wh.days)) {
        if (!dayConfig.enabled) continue;
        for (const s of dayConfig.shifts) {
          if (!map.has(s.name)) map.set(s.name, s);
        }
      }
      return [...map.values()];
    }
  }
}
