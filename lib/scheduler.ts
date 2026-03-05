import type { ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap } from '@/types/schedule';

/**
 * Generuje harmonogram pracy dla grupy osób podczas wielodobowej wycieczki.
 * Czysta funkcja bez efektów ubocznych.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const { peopleCount, hoursPerShift, durationDays, minBreakHours, names = [] } = params;

  const errors: string[] = [];
  const shifts: Shift[] = [];
  const coverageGaps: TimeGap[] = [];

  // Generuj nazwy osób
  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  // Krok 1 — Oblicz ile zmian na dobę
  const shiftsPerDay = Math.floor(24 / hoursPerShift);

  // Bloki czasowe dla jednej doby
  const blocks = Array.from({ length: shiftsPerDay }, (_, i) => ({
    start: i * hoursPerShift,
    end: (i + 1) * hoursPerShift,
  }));

  // Krok 2 & 3 — Algorytm greedy z weryfikacją przerw
  // Śledź ostatni koniec zmiany dla każdej osoby (w godzinach absolutnych od początku)
  const lastShiftEnd: number[] = new Array(peopleCount).fill(-Infinity);
  // Licznik godzin pracy per osoba
  const workHours: number[] = new Array(peopleCount).fill(0);
  // Licznik zmian per osoba
  const shiftCounts: number[] = new Array(peopleCount).fill(0);
  // Przechowuj wszystkie absolutne czasy końca zmian per osoba (do obliczenia min przerwy)
  const allShiftEnds: number[][] = Array.from({ length: peopleCount }, () => []);
  const allShiftStarts: number[][] = Array.from({ length: peopleCount }, () => []);

  for (let day = 1; day <= durationDays; day++) {
    for (const block of blocks) {
      // Absolutny czas startu tego bloku (od początku harmonogramu)
      const absoluteStart = (day - 1) * 24 + block.start;

      // Znajdź dostępne osoby
      const available: number[] = [];
      for (let p = 0; p < peopleCount; p++) {
        const timeSinceLastShift = absoluteStart - lastShiftEnd[p];
        if (timeSinceLastShift >= minBreakHours) {
          available.push(p);
        }
      }

      if (available.length === 0) {
        // Nie można obsadzić tego bloku
        coverageGaps.push({
          day,
          startHour: block.start,
          endHour: block.end,
        });
        errors.push(
          `Nie można obsadzić dnia ${day}, bloku ${block.start}:00–${block.end}:00 — zwiększ liczbę osób lub skróć wymaganą przerwę`
        );
        continue;
      }

      // Wybierz osobę z najmniejszą liczbą godzin pracy (balansowanie)
      available.sort((a, b) => workHours[a] - workHours[b]);
      const chosen = available[0];

      const absoluteEnd = (day - 1) * 24 + block.end;

      shifts.push({
        personId: chosen,
        personName: personNames[chosen],
        day,
        startHour: block.start,
        endHour: block.end,
        type: 'WORK',
      });

      allShiftStarts[chosen].push(absoluteStart);
      allShiftEnds[chosen].push(absoluteEnd);
      lastShiftEnd[chosen] = absoluteEnd;
      workHours[chosen] += hoursPerShift;
      shiftCounts[chosen] += 1;
    }
  }

  // Krok 4 — Oblicz statystyki
  const stats: PersonStats[] = personNames.map((name, i) => {
    // Oblicz minimalną przerwę
    let minBreak = Infinity;
    const starts = allShiftStarts[i];
    const ends = allShiftEnds[i];

    for (let s = 0; s < ends.length; s++) {
      // Szukaj następnego startu po tym końcu
      for (let ns = 0; ns < starts.length; ns++) {
        if (starts[ns] > ends[s]) {
          const gap = starts[ns] - ends[s];
          if (gap < minBreak) {
            minBreak = gap;
          }
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

  // Krok 5 — Walidacja końcowa
  const valid = coverageGaps.length === 0 && errors.length === 0;

  return {
    shifts,
    valid,
    errors,
    coverageGaps,
    stats,
  };
}
