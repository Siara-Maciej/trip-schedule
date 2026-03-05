import { describe, test, expect } from 'vitest';
import { generateSchedule } from './scheduler';

describe('scheduler', () => {
  test('4 osoby, 6h zmiana, 4 doby, 6h przerwy → valid: true, 0 luk, każda osoba codziennie', () => {
    // 4 zmiany/dobę, 4 osoby → idealnie
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 6,
      durationDays: 4,
      minBreakHours: 6,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    for (let day = 1; day <= 4; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(4);
    }
  });

  test('2 osoby, 8h zmiana, 1 doba, 11h przerwy → valid: false (za mało zmian dla 2 osób)', () => {
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 8,
      durationDays: 1,
      minBreakHours: 11,
    });
    expect(result.valid).toBe(false);
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
    const minBreak = 6;
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 6,
      durationDays: 4,
      minBreakHours: minBreak,
    });

    expect(result.valid).toBe(true);
    for (const stat of result.stats) {
      if (stat.shiftsCount > 1) {
        expect(stat.minBreakActual).toBeGreaterThanOrEqual(minBreak);
      }
    }
  });

  test('suma godzin pracy = durationDays * shiftsPerDay * hoursPerShift (pełne pokrycie)', () => {
    const hoursPerShift = 6;
    const durationDays = 4;
    const shiftsPerDay = Math.floor(24 / hoursPerShift);
    const expectedTotal = durationDays * shiftsPerDay * hoursPerShift;

    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift,
      durationDays,
      minBreakHours: 6,
    });

    expect(result.valid).toBe(true);
    const actualTotal = result.stats.reduce((sum, s) => sum + s.totalWorkHours, 0);
    expect(actualTotal).toBe(expectedTotal);
  });

  test('4 osoby, 8h zmiana → valid: false (3 zmiany/dobę < 4 osób)', () => {
    // 3 zmiany/dobę, 4 osoby → nie da się przydzielić każdej osobie zmianę co dobę
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('4 osoby, 6h zmiana, 3 doby, 6h przerwy → valid: true, każda osoba codziennie', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 6,
      durationDays: 3,
      minBreakHours: 6,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);

    for (let day = 1; day <= 3; day++) {
      const dayShifts = result.shifts.filter((s) => s.day === day);
      const personsWorking = new Set(dayShifts.map((s) => s.personId));
      expect(personsWorking.size).toBe(4);
    }
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

  test('6 osób, 6h zmiana, 5 dób → valid: false (4 zmiany < 6 osób)', () => {
    const result = generateSchedule({
      peopleCount: 6,
      hoursPerShift: 6,
      durationDays: 5,
      minBreakHours: 10,
    });
    expect(result.valid).toBe(false);
  });

  test('generowanie nazw osób domyślnych i niestandardowych', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 6,
      durationDays: 1,
      minBreakHours: 6,
      names: ['Jan', 'Anna'],
    });

    const names = result.stats.map((s) => s.personName);
    expect(names).toContain('Jan');
    expect(names).toContain('Anna');
    expect(names).toContain('Osoba 3');
    expect(names).toContain('Osoba 4');
  });

  test('5 osób, 4h zmiana, 2 doby, 8h przerwy → valid: true, każda osoba codziennie', () => {
    // 6 zmian/dobę, 5 osób → 5 muszą pracować + 1 ekstra zmiana
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
});
