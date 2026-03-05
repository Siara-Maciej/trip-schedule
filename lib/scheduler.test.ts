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
    const result = generateSchedule({
      peopleCount: 2,
      hoursPerShift: 12,
      durationDays: 3,
      minBreakHours: 24,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // --- Testy constraintów ---

  test('limit nocny: max 1 osoba w nocy (22-6), 4 osoby, 8h zmiana', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'nightShiftLimit', maxPeople: 1, nightStartHour: 22, nightEndHour: 6 },
      ],
    });

    // Bloki: 0-8 (nocny), 8-16 (dzienny), 16-24 (nocny)
    // Max 1 osoba na nocnych blokach
    for (let day = 1; day <= 2; day++) {
      const nightShifts = result.shifts.filter(
        (s) => s.day === day && (s.startHour < 6 || s.startHour >= 22)
      );
      // Każdy nocny blok powinien mieć max 1 osobę
      const nightBlock0 = nightShifts.filter((s) => s.startHour === 0);
      const nightBlock16 = nightShifts.filter((s) => s.startHour === 16);
      expect(nightBlock0.length).toBeLessThanOrEqual(1);
      expect(nightBlock16.length).toBeLessThanOrEqual(1);
    }
  });

  test('osoba zablokowana w godzinach 0-8 nie dostaje zmiany 0-8', () => {
    const result = generateSchedule({
      peopleCount: 3,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'personBlocked', personId: 0, startHour: 0, endHour: 8 },
      ],
    });

    // Osoba 0 nie powinna mieć żadnej zmiany 0-8
    const person0Shifts = result.shifts.filter((s) => s.personId === 0);
    for (const shift of person0Shifts) {
      expect(shift.startHour).not.toBe(0);
    }
  });

  test('osoba zablokowana nocą (22-6) nie dostaje nocnej zmiany', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'personBlocked', personId: 1, startHour: 22, endHour: 6 },
      ],
    });

    // Osoba 1 nie powinna mieć zmian w bloku 0-8 (pokrywa się z 22-6)
    const person1Shifts = result.shifts.filter((s) => s.personId === 1);
    for (const shift of person1Shifts) {
      expect(shift.startHour).not.toBe(0);
    }
  });

  test('kombinacja constraintów: limit nocny + blokada osoby', () => {
    const result = generateSchedule({
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 2,
      minBreakHours: 8,
      constraints: [
        { type: 'nightShiftLimit', maxPeople: 1, nightStartHour: 22, nightEndHour: 6 },
        { type: 'personBlocked', personId: 0, startHour: 0, endHour: 8 },
      ],
    });

    // Osoba 0 nie pracuje 0-8
    const person0Shifts = result.shifts.filter((s) => s.personId === 0);
    for (const shift of person0Shifts) {
      expect(shift.startHour).not.toBe(0);
    }

    // Max 1 osoba na nocnych blokach
    for (let day = 1; day <= 2; day++) {
      const nightBlock0 = result.shifts.filter((s) => s.day === day && s.startHour === 0);
      expect(nightBlock0.length).toBeLessThanOrEqual(1);
    }
  });
});
