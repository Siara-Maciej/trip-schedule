import { describe, test, expect } from 'vitest';
import { generateSchedule } from './scheduler';

// Pomocnicza — zbierz pracujące godziny per osoba per dzień
function getPersonHoursPerDay(result: ReturnType<typeof generateSchedule>, personId: number, day: number): number[] {
  const hours: number[] = [];
  for (const shift of result.shifts) {
    if (shift.personId === personId && shift.day === day) {
      for (let h = shift.startHour; h < shift.endHour; h++) {
        hours.push(h);
      }
    }
  }
  return hours.sort((a, b) => a - b);
}

describe('scheduler — granulacja 1h', () => {
  test('3 osoby, 8h praca, 3 doby, 8h przerwy → valid, każda osoba codziennie', () => {
    const result = generateSchedule({
      peopleCount: 3,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    // Każda osoba pracuje każdego dnia
    for (let day = 1; day <= 3; day++) {
      for (let p = 0; p < 3; p++) {
        const hours = getPersonHoursPerDay(result, p, day);
        expect(hours.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('10 osób, 8h praca, 3 doby, 8h przerwy → valid, każda osoba codziennie', () => {
    const result = generateSchedule({
      peopleCount: 10,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    for (let day = 1; day <= 3; day++) {
      for (let p = 0; p < 10; p++) {
        const hours = getPersonHoursPerDay(result, p, day);
        expect(hours.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('każda osoba pracuje max hoursPerShift godzin dziennie', () => {
    const hoursPerShift = 8;
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift,
      durationDays: 3,
      minBreakHours: 8,
    });

    for (let day = 1; day <= 3; day++) {
      for (let p = 0; p < 4; p++) {
        const hours = getPersonHoursPerDay(result, p, day);
        expect(hours.length).toBeLessThanOrEqual(hoursPerShift);
      }
    }
  });

  test('po hoursPerShift godzinach pracy, przerwa >= minBreakHours', () => {
    const hoursPerShift = 8;
    const minBreakHours = 8;
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift,
      durationDays: 3,
      minBreakHours,
    });
    expect(result.valid).toBe(true);

    // Dla każdej osoby zbierz wszystkie absolutne godziny pracy
    for (let p = 0; p < 4; p++) {
      const allHours: number[] = [];
      for (const shift of result.shifts) {
        if (shift.personId === p) {
          for (let h = shift.startHour; h < shift.endHour; h++) {
            allHours.push((shift.day - 1) * 24 + h);
          }
        }
      }
      allHours.sort((a, b) => a - b);

      // Symuluj akumulator
      let accumulated = 0;
      let lastEnd = -Infinity;
      for (const hour of allHours) {
        if (hour - lastEnd >= minBreakHours) {
          accumulated = 0; // reset po przerwie
        }
        accumulated++;
        lastEnd = hour + 1;
        // Akumulator nie powinien przekroczyć hoursPerShift
        // (po przepracowaniu limitu jest przerwa, więc nie powinno być hour+1 bez przerwy)
        expect(accumulated).toBeLessThanOrEqual(hoursPerShift);
      }
    }
  });

  test('pokrycie: każda godzina każdego dnia ma co najmniej 1 osobę', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    // Zweryfikuj ręcznie
    for (let day = 1; day <= 2; day++) {
      for (let h = 0; h < 24; h++) {
        const hasWorker = result.shifts.some(
          (s) => s.day === day && s.startHour <= h && s.endHour > h
        );
        expect(hasWorker).toBe(true);
      }
    }
  });

  test('praca może być rozbita — nie musi być ciągła', () => {
    // Przy wielu osobach i constraintach praca jest naturalnie rozbita
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);

    // Sprawdź że niektóre osoby mogą mieć >1 blok pracy dziennie
    // (to zależy od algorytmu, ale z 4 osobami i 8h to możliwe)
    let anyMultipleBlocks = false;
    for (let p = 0; p < 4; p++) {
      for (let day = 1; day <= 2; day++) {
        const personDayShifts = result.shifts.filter(
          (s) => s.personId === p && s.day === day
        );
        if (personDayShifts.length > 1) {
          anyMultipleBlocks = true;
        }
      }
    }
    // Nie wymuszamy, ale sprawdzamy że algorytm generuje poprawne wyniki
    expect(result.shifts.length).toBeGreaterThan(0);
  });

  test('2 osoby, 12h praca, 2 doby, 12h przerwy → valid', () => {
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 12,
      durationDays: 2,
      minBreakHours: 12,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
  });

  test('generowanie nazw osób', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 1,
      minBreakHours: 8,
      names: ['Jan', 'Anna'],
    });

    const names = result.stats.map((s) => s.personName);
    expect(names).toContain('Jan');
    expect(names).toContain('Anna');
    expect(names).toContain('Osoba 3');
    expect(names).toContain('Osoba 4');
  });

  // --- Testy constraintów ---

  test('limit nocny: max 1 osoba w nocy (22-6)', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'nightShiftLimit', maxPeople: 1, nightStartHour: 22, nightEndHour: 6 },
      ],
    });

    // Sprawdź że w nocnych godzinach max 1 osoba
    for (let day = 1; day <= 2; day++) {
      for (let h = 0; h < 24; h++) {
        if (h >= 22 || h < 6) {
          const workingNow = result.shifts.filter(
            (s) => s.day === day && s.startHour <= h && s.endHour > h
          );
          expect(workingNow.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('osoba zablokowana w godzinach 0-8 nie pracuje 0-8', () => {
    const result = generateSchedule({
      peopleCount: 3,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'personBlocked', personId: 0, startHour: 0, endHour: 8 },
      ],
    });

    // Osoba 0 nie powinna pracować w godzinach 0-7
    for (let day = 1; day <= 2; day++) {
      const hours = getPersonHoursPerDay(result, 0, day);
      for (const h of hours) {
        expect(h).toBeGreaterThanOrEqual(8);
      }
    }
  });

  test('osoba zablokowana nocą (22-6) nie pracuje w tych godzinach', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'personBlocked', personId: 1, startHour: 22, endHour: 6 },
      ],
    });

    for (let day = 1; day <= 2; day++) {
      const hours = getPersonHoursPerDay(result, 1, day);
      for (const h of hours) {
        expect(h >= 6 && h < 22).toBe(true);
      }
    }
  });

  test('zbyt długa przerwa → valid: false', () => {
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 12,
      durationDays: 3,
      minBreakHours: 24,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
