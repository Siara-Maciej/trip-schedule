import type { ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap } from '@/types/schedule';

// Pomocnicza funkcja — przydziel zmianę osobie
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
  workHours[p] += blocks[blockIdx].end - blocks[blockIdx].start;
  shiftCounts[p] += 1;
}

/**
 * Generuje harmonogram pracy dla grupy osób podczas wielodobowej wycieczki.
 * Każda osoba musi pracować co najmniej jedną zmianę każdego dnia.
 * W jednym bloku czasowym może pracować wiele osób jednocześnie.
 * Czysta funkcja bez efektów ubocznych.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const { peopleCount, hoursPerShift, durationDays, minBreakHours, names = [] } = params;

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

  const lastShiftEnd: number[] = new Array(peopleCount).fill(-Infinity);
  const workHours: number[] = new Array(peopleCount).fill(0);
  const shiftCounts: number[] = new Array(peopleCount).fill(0);
  const allShiftEnds: number[][] = Array.from({ length: peopleCount }, () => []);
  const allShiftStarts: number[][] = Array.from({ length: peopleCount }, () => []);
  const shifts: Shift[] = [];

  for (let day = 1; day <= durationDays; day++) {
    // Zbiór obsadzonych bloków w tym dniu
    const coveredBlocks = new Set<number>();

    // Faza 1: Każda osoba dostaje jedną zmianę
    for (let p = 0; p < peopleCount; p++) {
      const availableBlocks: number[] = [];
      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const absoluteStart = (day - 1) * 24 + blocks[blockIdx].start;
        if (absoluteStart - lastShiftEnd[p] >= minBreakHours) {
          availableBlocks.push(blockIdx);
        }
      }

      if (availableBlocks.length === 0) {
        errors.push(
          `${personNames[p]} nie może pracować w dniu ${day} — zbyt krótka przerwa od ostatniej zmiany. Skróć zmianę lub wymaganą przerwę.`
        );
        continue;
      }

      // Preferuj nieobsadzone bloki, potem mniej obciążone
      const uncoveredAvailable = availableBlocks.filter((b) => !coveredBlocks.has(b));

      let chosenBlockIdx: number;
      if (uncoveredAvailable.length > 0) {
        // Wybierz nieobsadzony blok z najmniejszą liczbą osób
        chosenBlockIdx = uncoveredAvailable[0];
      } else {
        // Wszystkie dostępne bloki już obsadzone — wybierz z najmniejszą liczbą osób
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

    // Faza 2: Uzupełnij nieobsadzone bloki (luki w pokryciu)
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      if (coveredBlocks.has(blockIdx)) continue;

      // Znajdź osobę która może wziąć ten blok
      const absoluteStart = (day - 1) * 24 + blocks[blockIdx].start;
      let bestPerson = -1;
      let bestWorkHours = Infinity;

      for (let p = 0; p < peopleCount; p++) {
        if (absoluteStart - lastShiftEnd[p] >= minBreakHours) {
          if (workHours[p] < bestWorkHours) {
            bestWorkHours = workHours[p];
            bestPerson = p;
          }
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
