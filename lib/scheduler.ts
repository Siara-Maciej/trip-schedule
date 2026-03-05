import type {
  ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap,
  NightShiftLimit, PersonBlockedHours, ScheduleConstraint,
} from '@/types/schedule';

// Sprawdź czy blok [blockStart, blockEnd) nakłada się z zakresem [rangeStart, rangeEnd)
// Obsługuje zakresy przechodzące przez północ (np. 22-6)
function blockOverlapsRange(blockStart: number, blockEnd: number, rangeStart: number, rangeEnd: number): boolean {
  if (rangeStart < rangeEnd) {
    // Zwykły zakres (np. 8-16)
    return blockStart < rangeEnd && blockEnd > rangeStart;
  }
  // Zakres przechodzący przez północ (np. 22-6) = [rangeStart, 24) + [0, rangeEnd)
  // Blok nakłada się z [rangeStart, 24)
  const overlapsEvening = blockStart < 24 && blockEnd > rangeStart;
  // Blok nakłada się z [0, rangeEnd)
  const overlapsMorning = blockStart < rangeEnd && blockEnd > 0;
  return overlapsEvening || overlapsMorning;
}

// Sprawdź czy osoba jest zablokowana dla danego bloku przez constrainty
function isPersonBlockedForBlock(
  personId: number,
  blockStart: number,
  blockEnd: number,
  constraints: ScheduleConstraint[],
): boolean {
  for (const c of constraints) {
    if (c.type === 'personBlocked' && c.personId === personId) {
      if (blockOverlapsRange(blockStart, blockEnd, c.startHour, c.endHour)) {
        return true;
      }
    }
  }
  return false;
}

// Sprawdź czy blok jest nocny wg constraintów
function isNightBlock(
  blockStart: number,
  blockEnd: number,
  nightConstraint: NightShiftLimit,
): boolean {
  return blockOverlapsRange(blockStart, blockEnd, nightConstraint.nightStartHour, nightConstraint.nightEndHour);
}

// Zlicz ile osób jest już przydzielonych do nocnego bloku danego dnia
function countNightAssignments(
  shifts: Shift[],
  day: number,
  blockStart: number,
  blockEnd: number,
  nightConstraint: NightShiftLimit,
): number {
  if (!isNightBlock(blockStart, blockEnd, nightConstraint)) return 0;
  return shifts.filter(
    (s) => s.day === day && isNightBlock(s.startHour, s.endHour, nightConstraint)
  ).length;
}

// Pomocnicza — przydziel zmianę
function assignShift(
  p: number,
  day: number,
  blockIdx: number,
  blocks: { start: number; end: number }[],
  personNames: string[],
  shifts: Shift[],
  allShiftStarts: number[][],
  allShiftEnds: number[][],
  lastShiftEnd: number[],
  workHours: number[],
  shiftCounts: number[],
) {
  const block = blocks[blockIdx];
  const absoluteStart = (day - 1) * 24 + block.start;
  const absoluteEnd = (day - 1) * 24 + block.end;

  shifts.push({
    personId: p,
    personName: personNames[p],
    day,
    startHour: block.start,
    endHour: block.end,
    type: 'WORK',
  });

  allShiftStarts[p].push(absoluteStart);
  allShiftEnds[p].push(absoluteEnd);
  lastShiftEnd[p] = absoluteEnd;
  workHours[p] += block.end - block.start;
  shiftCounts[p] += 1;
}

/**
 * Generuje harmonogram pracy dla grupy osób podczas wielodobowej wycieczki.
 * Każda osoba musi pracować co najmniej jedną zmianę każdego dnia.
 * W jednym bloku czasowym może pracować wiele osób jednocześnie.
 * Respektuje ograniczenia: limit osób w nocy, zablokowane godziny dla osób.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const { peopleCount, hoursPerShift, durationDays, minBreakHours, names = [], constraints = [] } = params;

  const errors: string[] = [];
  const coverageGaps: TimeGap[] = [];

  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  const shiftsPerDay = Math.floor(24 / hoursPerShift);
  const blocks = Array.from({ length: shiftsPerDay }, (_, i) => ({
    start: i * hoursPerShift,
    end: (i + 1) * hoursPerShift,
  }));

  // Wyciągnij constraint nocny (może być max 1)
  const nightConstraint = constraints.find((c): c is NightShiftLimit => c.type === 'nightShiftLimit') ?? null;

  const lastShiftEnd: number[] = new Array(peopleCount).fill(-Infinity);
  const workHours: number[] = new Array(peopleCount).fill(0);
  const shiftCounts: number[] = new Array(peopleCount).fill(0);
  const allShiftEnds: number[][] = Array.from({ length: peopleCount }, () => []);
  const allShiftStarts: number[][] = Array.from({ length: peopleCount }, () => []);
  const shifts: Shift[] = [];

  // Sprawdź czy osoba może wziąć blok (przerwa + constrainty)
  function canPersonTakeBlock(p: number, day: number, blockIdx: number): boolean {
    const block = blocks[blockIdx];
    const absoluteStart = (day - 1) * 24 + block.start;

    // Sprawdź minimalną przerwę
    if (absoluteStart - lastShiftEnd[p] < minBreakHours) return false;

    // Sprawdź blokadę osoby
    if (isPersonBlockedForBlock(p, block.start, block.end, constraints)) return false;

    // Sprawdź limit nocny
    if (nightConstraint && isNightBlock(block.start, block.end, nightConstraint)) {
      const currentNightCount = countNightAssignments(shifts, day, block.start, block.end, nightConstraint);
      if (currentNightCount >= nightConstraint.maxPeople) return false;
    }

    return true;
  }

  for (let day = 1; day <= durationDays; day++) {
    const coveredBlocks = new Set<number>();

    // Faza 1: Każda osoba dostaje jedną zmianę
    for (let p = 0; p < peopleCount; p++) {
      const availableBlocks: number[] = [];
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        if (canPersonTakeBlock(p, day, blockIdx)) {
          availableBlocks.push(blockIdx);
        }
      }

      if (availableBlocks.length === 0) {
        errors.push(
          `${personNames[p]} nie może pracować w dniu ${day} — brak dostępnych bloków (przerwa/ograniczenia). Skróć zmianę, przerwę lub zmień ograniczenia.`
        );
        continue;
      }

      // Preferuj nieobsadzone bloki
      const uncoveredAvailable = availableBlocks.filter((b) => !coveredBlocks.has(b));

      let chosenBlockIdx: number;
      if (uncoveredAvailable.length > 0) {
        chosenBlockIdx = uncoveredAvailable[0];
      } else {
        // Wybierz blok z najmniejszą liczbą osób
        const blockPersonCounts = new Map<number, number>();
        for (const s of shifts) {
          if (s.day === day) {
            const bIdx = blocks.findIndex((b) => b.start === s.startHour);
            if (bIdx >= 0) blockPersonCounts.set(bIdx, (blockPersonCounts.get(bIdx) || 0) + 1);
          }
        }
        availableBlocks.sort((a, b) => {
          const ca = blockPersonCounts.get(a) || 0;
          const cb = blockPersonCounts.get(b) || 0;
          return ca - cb;
        });
        chosenBlockIdx = availableBlocks[0];
      }

      assignShift(p, day, chosenBlockIdx, blocks, personNames, shifts, allShiftStarts, allShiftEnds, lastShiftEnd, workHours, shiftCounts);
      coveredBlocks.add(chosenBlockIdx);
    }

    // Faza 2: Uzupełnij nieobsadzone bloki
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      if (coveredBlocks.has(blockIdx)) continue;

      let bestPerson = -1;
      let bestWorkHours = Infinity;

      for (let p = 0; p < peopleCount; p++) {
        if (canPersonTakeBlock(p, day, blockIdx) && workHours[p] < bestWorkHours) {
          bestWorkHours = workHours[p];
          bestPerson = p;
        }
      }

      if (bestPerson >= 0) {
        assignShift(bestPerson, day, blockIdx, blocks, personNames, shifts, allShiftStarts, allShiftEnds, lastShiftEnd, workHours, shiftCounts);
        coveredBlocks.add(blockIdx);
      }
    }
  }

  // Sprawdź pokrycie
  for (let day = 1; day <= durationDays; day++) {
    for (const block of blocks) {
      const hasWorker = shifts.some(
        (s) => s.day === day && s.startHour === block.start && s.endHour === block.end
      );
      if (!hasWorker) {
        coverageGaps.push({ day, startHour: block.start, endHour: block.end });
      }
    }
  }

  // Oblicz statystyki
  const stats: PersonStats[] = personNames.map((name, i) => {
    let minBreak = Infinity;
    const starts = allShiftStarts[i];
    const ends = allShiftEnds[i];

    for (let s = 0; s < ends.length; s++) {
      for (let ns = 0; ns < starts.length; ns++) {
        if (starts[ns] > ends[s]) {
          const gap = starts[ns] - ends[s];
          if (gap < minBreak) minBreak = gap;
        }
      }
    }

    return {
      personId: i,
      personName: name,
      totalWorkHours: workHours[i],
      shiftsCount: shiftCounts[i],
      minBreakActual: minBreak === Infinity ? 0 : minBreak,
    };
  });

  const valid = coverageGaps.length === 0 && errors.length === 0;

  return { shifts, valid, errors, coverageGaps, stats };
}
