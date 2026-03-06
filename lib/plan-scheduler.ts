import type { Person } from '@/types/person';
import type {
  PeriodConfig,
  WorkingHoursConfig,
  StaffConstraints,
  ShiftDefinition,
  HourOverrides,
  PlanShift,
  PlanResult,
} from '@/types/schedule-plan';

const DAY_LABELS = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

/** Compute shift duration in hours, handling overnight shifts (e.g. 18:00-06:00 = 12h) */
function shiftDuration(startH: number, endH: number): number {
  return endH > startH ? endH - startH : 24 - startH + endH;
}

/** Check if two shifts overlap, handling overnight wraparound */
function shiftsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  const a1 = s1, a2 = e1 <= s1 ? e1 + 24 : e1;
  const b1 = s2, b2 = e2 <= s2 ? e2 + 24 : e2;
  return a1 < b2 && a2 > b1;
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

function getAllShifts(wh: WorkingHoursConfig): ShiftDefinition[] {
  switch (wh.type) {
    case 'continuous':
      return [{ name: 'Zmiana', startTime: '00:00', endTime: '24:00', required: true, minPerPersonInPeriod: 0 }];
    case 'fixed':
      return [{ name: 'Zmiana', startTime: wh.startTime, endTime: wh.endTime, required: true, minPerPersonInPeriod: 0 }];
    case 'shifts':
      return wh.shifts;
    case 'custom': {
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

const MIN_REST_HOURS = 8;

interface DaySlot {
  shift: ShiftDefinition;
  startH: number;
  endH: number;
  shiftHours: number;
  assigned: Person[];
}

/**
 * Main scheduler with:
 * 1. Budget pacing — pre-computes bonus capacity and spreads days off evenly
 * 2. Optional shift reservation — reserves budget for mandatory optional quotas
 *    (e.g. 1×12h/person/month) before consuming it all on required shifts
 * 3. Overnight shift support (e.g. 18:00-06:00 = 12h)
 */
export function generatePlanSchedule(
  people: Person[],
  period: PeriodConfig,
  workingHours: WorkingHoursConfig,
  constraints: StaffConstraints,
  hourOverrides: HourOverrides = {},
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

  // ── Budgets ──
  const defaultBudget = constraints.defaultHoursPerPeriod ?? 160;
  const hoursUsed = new Map<string, number>();
  const hoursBudget = new Map<string, number>();
  for (const p of people) {
    hoursUsed.set(p.id, 0);
    hoursBudget.set(p.id, hourOverrides[p.id] ?? defaultBudget);
  }

  // ── Reserve hours for optional shift quotas ──
  const allShifts = getAllShifts(workingHours);
  let reservedPerPerson = 0;
  for (const shift of allShifts) {
    const isRequired = shift.required ?? true;
    const minPer = shift.minPerPersonInPeriod ?? 0;
    if (!isRequired && minPer > 0) {
      const startH = parseHour(shift.startTime);
      const endH = shift.endTime === '24:00' ? 24 : parseHour(shift.endTime);
      reservedPerPerson += minPer * shiftDuration(startH, endH);
    }
  }

  // Effective budget for required shifts = total - reserved for optional
  const effectiveBudget = new Map<string, number>();
  for (const p of people) {
    const total = hoursBudget.get(p.id)!;
    effectiveBudget.set(p.id, Math.max(0, total - reservedPerPerson));
  }

  // ── Pre-compute: required shift hours per day ──
  const requiredHoursPerDay: number[] = [];
  for (const date of dates) {
    const dowMon = jsDowToMon(date.getDay());
    const dayShifts = getShiftsForDay(workingHours, dowMon);
    let dayHours = 0;
    for (const shift of dayShifts) {
      if (!(shift.required ?? true)) continue;
      const startH = parseHour(shift.startTime);
      const endH = shift.endTime === '24:00' ? 24 : parseHour(shift.endTime);
      dayHours += shiftDuration(startH, endH);
    }
    requiredHoursPerDay.push(dayHours);
  }

  // ── Pre-compute bonus capacity per day ──
  // Each person can work N = floor(effectiveBudget / avgShiftHours) days on required shifts.
  // With oneShiftPerDay, subtract days consumed by optional shift quotas.
  const avgRequiredHoursPerDay = requiredHoursPerDay.reduce((a, b) => a + b, 0) / dates.length || 8;
  const requiredSlotsPerDay = (() => {
    const sample = dates[0];
    const dowMon = jsDowToMon(sample.getDay());
    return getShiftsForDay(workingHours, dowMon).filter(s => s.required ?? true).length || 1;
  })();

  // Days each person loses to optional shifts (when oneShiftPerDay)
  let optionalDaysPerPerson = 0;
  if (oneShiftPerDay) {
    for (const shift of allShifts) {
      if (!(shift.required ?? true)) {
        optionalDaysPerPerson += shift.minPerPersonInPeriod ?? 0;
      }
    }
  }

  let totalPersonShiftDays = 0;
  for (const p of people) {
    const eb = effectiveBudget.get(p.id)!;
    const maxDays = Math.floor(eb / avgRequiredHoursPerDay);
    // Subtract days that will be used for optional shifts
    totalPersonShiftDays += Math.max(0, maxDays - optionalDaysPerPerson);
  }
  const totalMinSlots = dates.length * constraints.minPerShift * requiredSlotsPerDay;
  const bonusPersonSlots = Math.max(0, totalPersonShiftDays * requiredSlotsPerDay - totalMinSlots);

  // Distribute bonus slots evenly: each day gets a share
  // bonusCapPerDay[i] = how many extra person-slots (above min) allowed on day i
  const bonusCapPerDay: number[] = [];
  if (dates.length > 0 && bonusPersonSlots > 0) {
    const baseBonus = Math.floor(bonusPersonSlots / dates.length);
    const remainder = bonusPersonSlots % dates.length;
    for (let i = 0; i < dates.length; i++) {
      // Spread remainder across first N days
      bonusCapPerDay.push(baseBonus + (i < remainder ? 1 : 0));
    }
  } else {
    for (let i = 0; i < dates.length; i++) bonusCapPerDay.push(0);
  }

  const lastShiftEnd = new Map<string, number>();
  const periodStartTime = dates[0].getTime();

  const shiftTypeCounts = new Map<string, Map<string, number>>();
  for (const p of people) shiftTypeCounts.set(p.id, new Map());

  const resultShifts: PlanShift[] = [];

  // ── Per-day scheduling ──
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const date = dates[dayIndex];
    const dowMon = jsDowToMon(date.getDay());
    const dayShifts = getShiftsForDay(workingHours, dowMon);
    if (dayShifts.length === 0) continue;

    const dayLabel = `${DAY_LABELS[date.getDay()]} ${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`;
    const dateStr = date.toISOString().slice(0, 10);
    const dayOffsetHours = (date.getTime() - periodStartTime) / (1000 * 60 * 60);

    const assignedToday = new Set<string>();

    // Build slots
    const requiredSlots: DaySlot[] = [];
    const optionalSlots: DaySlot[] = [];

    for (const shift of dayShifts) {
      const startH = parseHour(shift.startTime);
      const endH = shift.endTime === '24:00' ? 24 : parseHour(shift.endTime);
      const shiftHours = shiftDuration(startH, endH);
      if (shiftHours <= 0) continue;

      const slot: DaySlot = { shift, startH, endH, shiftHours, assigned: [] };
      if (shift.required ?? true) {
        requiredSlots.push(slot);
      } else {
        optionalSlots.push(slot);
      }
    }

    // ── Eligibility checks ──
    const isEligible = (person: Person, slot: DaySlot): boolean => {
      if (person.unavailableDays.includes(dowMon)) return false;
      if (oneShiftPerDay && assignedToday.has(person.id)) return false;

      if (!oneShiftPerDay) {
        for (const rs of [...requiredSlots, ...optionalSlots]) {
          if (rs.assigned.some((p) => p.id === person.id)) {
            if (shiftsOverlap(slot.startH, slot.endH, rs.startH, rs.endH)) return false;
          }
        }
      }

      const absoluteStart = dayOffsetHours + slot.startH;
      const lastEnd = lastShiftEnd.get(person.id);
      if (lastEnd !== undefined && absoluteStart - lastEnd < MIN_REST_HOURS) return false;

      return true;
    };

    const canWorkRequired = (person: Person, slot: DaySlot): boolean => {
      if (!isEligible(person, slot)) return false;
      const used = hoursUsed.get(person.id) ?? 0;
      const eBudget = effectiveBudget.get(person.id) ?? 0;
      return used + slot.shiftHours <= eBudget;
    };

    const canWorkOptional = (person: Person, slot: DaySlot): boolean => {
      if (!isEligible(person, slot)) return false;
      const used = hoursUsed.get(person.id) ?? 0;
      const budget = hoursBudget.get(person.id) ?? 0;
      return used + slot.shiftHours <= budget;
    };

    // ── Assign helper ──
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

    // ── Scoring: prefer person with most remaining budget ──
    const scorePerson = (
      person: Person,
      shiftName: string,
      useEffectiveBudget: boolean,
    ): [number, number] => {
      const used = hoursUsed.get(person.id) ?? 0;
      const budget = useEffectiveBudget
        ? (effectiveBudget.get(person.id) ?? 0)
        : (hoursBudget.get(person.id) ?? 0);
      const remaining = budget - used;
      const typeCount = shiftTypeCounts.get(person.id)?.get(shiftName) ?? 0;
      if (fairDistribution) {
        return [typeCount, -remaining];
      }
      return [-remaining, typeCount];
    };

    const compareScores = (a: [number, number], b: [number, number]): number => {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] - b[1];
    };

    const pickBest = (
      candidates: Person[],
      slot: DaySlot,
      canWorkFn: (p: Person, s: DaySlot) => boolean,
      useEffective: boolean,
    ): Person | null => {
      let best: Person | null = null;
      let bestScore: [number, number] = [Infinity, Infinity];

      for (const p of candidates) {
        if (!canWorkFn(p, slot)) continue;
        const score = scorePerson(p, slot.shift.name, useEffective);
        if (compareScores(score, bestScore) < 0) {
          best = p;
          bestScore = score;
        }
      }
      return best;
    };

    // ══════════════════════════════════════════════════════
    // PHASE 1a: Fill required shifts to minPerShift (MUST fill)
    // ══════════════════════════════════════════════════════

    if (requiredSlots.length > 0) {
      const stuckSlots = new Set<DaySlot>();

      while (true) {
        const needySlots = requiredSlots
          .filter((s) => s.assigned.length < constraints.minPerShift && !stuckSlots.has(s))
          .sort((a, b) => a.assigned.length - b.assigned.length);
        if (needySlots.length === 0) break;

        const slot = needySlots[0];
        const best = pickBest(people, slot, canWorkRequired, true);

        if (best) {
          assignPerson(best, slot);
          stuckSlots.clear();
        } else {
          stuckSlots.add(slot);
        }
      }

      // ══════════════════════════════════════════════════════
      // PHASE 1b: Fill required shifts up to maxPerShift (BONUS)
      // Limited by pre-computed bonus capacity for this day.
      // ══════════════════════════════════════════════════════

      let bonusLeft = bonusCapPerDay[dayIndex];
      const stuckSlots2 = new Set<DaySlot>();

      while (bonusLeft > 0) {
        const fillableSlots = requiredSlots
          .filter((s) => s.assigned.length < constraints.maxPerShift && !stuckSlots2.has(s))
          .sort((a, b) => a.assigned.length - b.assigned.length);
        if (fillableSlots.length === 0) break;

        const slot = fillableSlots[0];
        const best = pickBest(people, slot, canWorkRequired, true);

        if (best) {
          assignPerson(best, slot);
          bonusLeft--;
          stuckSlots2.clear();
        } else {
          stuckSlots2.add(slot);
        }
      }

      // Warnings for under-staffed
      for (const slot of requiredSlots) {
        if (slot.assigned.length < constraints.minPerShift) {
          warnings.push(
            `${dayLabel}, ${slot.shift.name}: przypisano ${slot.assigned.length}/${constraints.minPerShift} wymaganych`,
          );
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // PHASE 2: Optional shifts — fulfil per-person quotas
    // Uses FULL budget (reserved hours are for this).
    // ══════════════════════════════════════════════════════

    for (const slot of optionalSlots) {
      const minPerPerson = slot.shift.minPerPersonInPeriod ?? 0;

      const candidates = people
        .filter((p) => canWorkOptional(p, slot))
        .map((p) => {
          const done = shiftTypeCounts.get(p.id)?.get(slot.shift.name) ?? 0;
          const deficit = minPerPerson - done;
          return { person: p, deficit, done };
        })
        .filter((c) => c.deficit > 0)
        .sort((a, b) => {
          if (a.deficit !== b.deficit) return b.deficit - a.deficit;
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
  for (const shift of allShifts) {
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

  // ── Budget usage warnings ──
  for (const p of people) {
    const used = hoursUsed.get(p.id) ?? 0;
    const budget = hoursBudget.get(p.id) ?? 0;
    if (used < budget * 0.9) {
      warnings.push(`${p.name}: wykorzystano ${used}h z ${budget}h budżetu`);
    }
  }

  const totalHours = resultShifts.reduce((s, sh) => s + shiftDuration(sh.startHour, sh.endHour), 0);

  return {
    shifts: resultShifts,
    warnings,
    totalHours,
    daysCount: dates.length,
  };
}
