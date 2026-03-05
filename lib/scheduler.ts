import type { ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap } from '@/types/schedule';

/**
 * Generuje harmonogram pracy dla grupy osób podczas wielodobowej wycieczki.
 * Każda osoba musi pracować co najmniej jedną zmianę każdego dnia.
 * Czysta funkcja bez efektów ubocznych.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const { peopleCount, hoursPerShift, durationDays, minBreakHours, names = [] } = params;

  const errors: string[] = [];
  const coverageGaps: TimeGap[] = [];

  // Generuj nazwy osób
  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  // Krok 1 — Oblicz ile zmian na dobę
  const shiftsPerDay = Math.floor(24 / hoursPerShift);

  // Sprawdź czy wystarczy zmian na dobę, żeby każda osoba pracowała
  if (shiftsPerDay < peopleCount) {
    errors.push(
      `Za mało zmian na dobę (${shiftsPerDay}) dla ${peopleCount} osób — każda osoba musi pracować codziennie. Skróć długość zmiany lub zmniejsz liczbę osób.`
    );
  }

  // Bloki czasowe dla jednej doby
  const blocks = Array.from({ length: shiftsPerDay }, (_, i) => ({
    start: i * hoursPerShift,
    end: (i + 1) * hoursPerShift,
  }));

  // Krok 2 & 3 — Algorytm greedy z wymuszeniem pracy każdej osoby każdego dnia
  const lastShiftEnd: number[] = new Array(peopleCount).fill(-Infinity);
  const workHours: number[] = new Array(peopleCount).fill(0);
  const shiftCounts: number[] = new Array(peopleCount).fill(0);
  const allShiftEnds: number[][] = Array.from({ length: peopleCount }, () => []);
  const allShiftStarts: number[][] = Array.from({ length: peopleCount }, () => []);
  const shifts: Shift[] = [];

  // Śledź kto pracował danego dnia
  const workedToday: Set<number>[] = [];

  for (let day = 1; day <= durationDays; day++) {
    const todayWorked = new Set<number>();
    workedToday.push(todayWorked);

    // Zbierz dostępność dla każdego bloku
    const blockAssignments: (number | null)[] = new Array(blocks.length).fill(null);

    // Faza 1: Przydziel osoby które jeszcze nie pracowały dziś (priorytet)
    // Iteruj bloki i przydzielaj, preferując osoby bez zmiany w tym dniu
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx];
      const absoluteStart = (day - 1) * 24 + block.start;

      // Znajdź dostępne osoby (spełniające minBreakHours)
      const available: number[] = [];
      for (let p = 0; p < peopleCount; p++) {
        const timeSinceLastShift = absoluteStart - lastShiftEnd[p];
        if (timeSinceLastShift >= minBreakHours) {
          available.push(p);
        }
      }

      if (available.length === 0) {
        coverageGaps.push({ day, startHour: block.start, endHour: block.end });
        errors.push(
          `Nie można obsadzić dnia ${day}, bloku ${block.start}:00–${block.end}:00 — zwiększ liczbę osób lub skróć wymaganą przerwę`
        );
        continue;
      }

      // Osoby które jeszcze nie pracowały dziś
      const notYetWorked = available.filter((p) => !todayWorked.has(p));
      // Pozostałe bloki do obsadzenia w tym dniu
      const remainingBlocks = blocks.length - blockIdx;
      // Ile osób jeszcze musi dostać zmianę dziś
      const peopleStillNeedWork = peopleCount - todayWorked.size;

      let chosen: number;

      if (notYetWorked.length > 0 && peopleStillNeedWork >= remainingBlocks) {
        // Musimy priorytetowo dać zmianę komuś kto jeszcze nie pracował
        // Wybierz osobę z najmniejszą liczbą godzin spośród tych co nie pracowały
        notYetWorked.sort((a, b) => workHours[a] - workHours[b]);
        chosen = notYetWorked[0];
      } else if (notYetWorked.length > 0) {
        // Preferuj osoby bez zmiany, ale nie jest to krytyczne
        // Połącz z balansowaniem — wybierz z notYetWorked osobę z min godzin
        notYetWorked.sort((a, b) => workHours[a] - workHours[b]);
        // Porównaj z best available
        available.sort((a, b) => workHours[a] - workHours[b]);
        // Jeśli osoba z notYetWorked ma zbliżoną liczbę godzin — daj jej priorytet
        chosen = notYetWorked[0];
      } else {
        // Wszystkie osoby już pracowały — balansuj normalnie
        available.sort((a, b) => workHours[a] - workHours[b]);
        chosen = available[0];
      }

      const absoluteEnd = (day - 1) * 24 + block.end;

      shifts.push({
        personId: chosen,
        personName: personNames[chosen],
        day,
        startHour: block.start,
        endHour: block.end,
        type: 'WORK',
      });

      blockAssignments[blockIdx] = chosen;
      todayWorked.add(chosen);
      allShiftStarts[chosen].push(absoluteStart);
      allShiftEnds[chosen].push(absoluteEnd);
      lastShiftEnd[chosen] = absoluteEnd;
      workHours[chosen] += hoursPerShift;
      shiftCounts[chosen] += 1;
    }

    // Sprawdź czy każda osoba pracowała dziś
    for (let p = 0; p < peopleCount; p++) {
      if (!todayWorked.has(p)) {
        errors.push(
          `${personNames[p]} nie ma przydzielonej zmiany w dniu ${day} — za mało zmian na dobę lub zbyt długa przerwa`
        );
      }
    }
  }

  // Krok 4 — Oblicz statystyki
  const stats: PersonStats[] = personNames.map((name, i) => {
    let minBreak = Infinity;
    const starts = allShiftStarts[i];
    const ends = allShiftEnds[i];

    for (let s = 0; s < ends.length; s++) {
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
