import { describe, test, expect } from 'vitest';
import { generateSchedule } from './scheduler';

describe('scheduler', () => {
  test('4 osoby, 8h zmiana, 4 doby, 11h przerwy → valid: true, 0 luk', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 4,
      minBreakHours: 11,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test('2 osoby, 8h zmiana, 1 doba, 11h przerwy → valid: false (za mało osób)', () => {
    // 2 osoby × 8h = 16 < 24, ale walidacja Zod łapie to wcześniej
    // Jednak algorytm powinien poradzić sobie z 3 zmianami na dobę (24/8=3)
    // 2 osoby, 3 zmiany, 11h przerwy → osoba 1: 0-8, osoba 2: 8-16, osoba 1: 16-24?
    // Przerwa osoby 1: 16-8=8h < 11h → nie może! → valid: false
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 8,
      durationDays: 1,
      minBreakHours: 11,
    });
    expect(result.valid).toBe(false);
    expect(result.coverageGaps.length).toBeGreaterThan(0);
  });

  test('3 osoby, 8h zmiana, 3 doby, 8h przerwy → valid: true', () => {
    const result = generateSchedule({
      peopleCount: 3,
      hoursPerShift: 8,
      durationDays: 3,
      minBreakHours: 8,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
  });

  test('każda przerwa >= minBreakHours w wygenerowanym planie', () => {
    const minBreak = 11;
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 4,
      minBreakHours: minBreak,
    });

    // Sprawdź minimalną przerwę każdej osoby
    for (const stat of result.stats) {
      if (stat.shiftsCount > 1) {
        expect(stat.minBreakActual).toBeGreaterThanOrEqual(minBreak);
      }
    }
  });

  test('suma godzin pracy = durationDays * shiftsPerDay * hoursPerShift (pełne pokrycie)', () => {
    const hoursPerShift = 8;
    const durationDays = 4;
    const shiftsPerDay = Math.floor(24 / hoursPerShift);
    const expectedTotal = durationDays * shiftsPerDay * hoursPerShift;

    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift,
      durationDays,
      minBreakHours: 11,
    });

    const actualTotal = result.stats.reduce((sum, s) => sum + s.totalWorkHours, 0);
    expect(actualTotal).toBe(expectedTotal);
  });

  test('brak osoby z > 1 zmianą na tę samą dobę (przy wystarczającej liczbie osób)', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 4,
      minBreakHours: 11,
    });

    // Grupuj zmiany per osoba per dzień
    const personDayShifts = new Map<string, number>();
    for (const shift of result.shifts) {
      const key = `${shift.personId}-${shift.day}`;
      personDayShifts.set(key, (personDayShifts.get(key) || 0) + 1);
    }

    for (const [key, count] of personDayShifts) {
      expect(count).toBeLessThanOrEqual(1);
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
  });

  test('6 osób, 6h zmiana, 5 dób, 10h przerwy → valid: true, 4 zmiany/dobę', () => {
    const result = generateSchedule({
      peopleCount: 6,
      hoursPerShift: 6,
      durationDays: 5,
      minBreakHours: 10,
    });
    expect(result.valid).toBe(true);
    expect(result.coverageGaps).toHaveLength(0);
    // 4 zmiany na dobę × 5 dób = 20 zmian
    expect(result.shifts).toHaveLength(20);
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
});
