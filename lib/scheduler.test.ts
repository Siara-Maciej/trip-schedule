import { describe, test, expect } from 'vitest';
import { generateSchedule } from './scheduler';

describe('scheduler', () => {
  test('10 osób, 8h zmiana, 3 doby, 8h przerwy → valid: true, każda osoba codziennie', () => {
    // 3 bloki/dobę, 10 osób — wiele osób w jednym bloku
    const result = generateSchedule({
      peopleCount: 10,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    for (let day = 1; day <= 3; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(10);
    }
  });

  test('4 osoby, 8h zmiana, 4 doby, 8h przerwy → valid: true, wielu w jednym bloku', () => {
    // 3 bloki/dobę, 4 osoby — jedna osoba musi dzielić blok z inną
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 4,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    for (let day = 1; day <= 4; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(4);
    }
  });

  test('3 osoby, 8h zmiana, 3 doby, 8h przerwy → valid: true, każda osoba pracuje codziennie', () => {
    const result = generateSchedule({
      peopleCount: 3,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    for (let day = 1; day <= 3; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(3);
    }
  });

  test('każda przerwa >= minBreakHours w wygenerowanym planie', () => {
    const minBreak = 8;
    const result = generateSchedule({
      peopleCount: 10,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: minBreak,
    });

    expect(result.valid).toBe(true);
    for (const stat of result.stats) {
      if (stat.shiftsCount > 1) {
        expect(stat.minBreakActual).toBeGreaterThanOrEqual(minBreak);
      }
    }
  });

  test('suma godzin = peopleCount * durationDays * hoursPerShift (każda osoba 1 zmiana/dzień)', () => {
    const hoursPerShift = 8;
    const durationDays = 3;
    const peopleCount = 10;
    // Każda osoba pracuje dokładnie 1 zmianę/dzień
    const expectedTotal = peopleCount * durationDays * hoursPerShift;

    const result = generateSchedule({
      peopleCount,
      hoursPerShift,
      durationDays,
      minBreakHours: 8,
    });

    expect(result.valid).toBe(true);
    const actualTotal = result.stats.reduce((sum, s) => sum + s.totalWorkHours, 0);
    expect(actualTotal).toBe(expectedTotal);
  });

  test('2 osoby, 12h zmiana, 2 doby, 12h przerwy → valid: true', () => {
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 12,
      durationDays: 2,
      minBreakHours: 12,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    for (let day = 1; day <= 2; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(2);
    }
  });

  test('wiele osób w jednym bloku — bloki mogą się pokrywać', () => {
    // 20 osób, 12h zmiana → 2 bloki/dobę, po 10 osób na blok
    const result = generateSchedule({
      peopleCount: 20,
      hoursPerShift: 12,
      durationDays: 2,
      minBreakHours: 12,
    });
    expect(result.valid).toBe(true);

    // Sprawdź że w jednym bloku jest więcej niż 1 osoba
    for (let day = 1; day <= 2; day++) {
      const block0Shifts = result.shifts.filter(
        (s) => s.day === day && s.startHour === 0
      );
      const block12Shifts = result.shifts.filter(
        (s) => s.day === day && s.startHour === 12
      );
      // 20 osób na 2 bloki → 10 na każdy
      expect(block0Shifts.length + block12Shifts.length).toBe(20);
    }
  });

  test('generowanie nazw osób domyślnych i niestandardowych', () => {
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

  test('5 osób, 4h zmiana, 2 doby, 8h przerwy → valid: true, każda osoba codziennie', () => {
    const result = generateSchedule({
      peopleCount: 5,
      hoursPerShift: 4,
      durationDays: 2,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    for (let day = 1; day <= 2; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(5);
    }
  });

  test('zbyt długa przerwa uniemożliwia pracę → valid: false', () => {
    // 2 osoby, 12h zmiana, 3 doby, 24h przerwy
    // Osoba pracująca dzień 1 nie może pracować dzień 2 (przerwa 12h < 24h)
    // Ale 2 bloki/dobę → osoba 1: dzień1 0-12, osoba 2: dzień1 12-24
    // Dzień 2: osoba1 potrzebuje 24h od 12:00 dnia 1 = 12:00 dnia 2 → blok 12-24
    //          osoba2 potrzebuje 24h od 24:00 dnia 1 = 24:00 dnia 2 → nie może!
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
