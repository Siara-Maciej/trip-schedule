import type {
  ScheduleParams, ScheduleResult, Shift, PersonStats, TimeGap,
  NightShiftLimit, ScheduleConstraint,
} from '@/types/schedule';

// Sprawdź czy godzina mieści się w zakresie (obsługuje przejście przez północ)
function isHourInRange(hour: number, rangeStart: number, rangeEnd: number): boolean {
  if (rangeStart < rangeEnd) {
    return hour >= rangeStart && hour < rangeEnd;
  }
  // Zakres przez północ (np. 22-6)
  return hour >= rangeStart || hour < rangeEnd;
}

// Sprawdź czy osoba jest zablokowana dla danej godziny
function isPersonBlockedForHour(
  personId: number,
  hour: number,
  constraints: ScheduleConstraint[],
): boolean {
  for (const c of constraints) {
    if (c.type === 'personBlocked' && c.personId === personId) {
      if (isHourInRange(hour, c.startHour, c.endHour)) {
        return true;
      }
    }
  }
  return false;
}

// Łączy posortowaną listę godzin w ciągłe bloki (Shift)
function mergeHoursIntoShifts(
  personId: number,
  personName: string,
  hours: number[], // absolutne godziny, posortowane rosnąco
): Shift[] {
  if (hours.length === 0) return [];
  const shifts: Shift[] = [];

  let blockStart = hours[0];
  let blockEnd = hours[0] + 1;

  for (let i = 1; i < hours.length; i++) {
    if (hours[i] === blockEnd) {
      // Kontynuacja ciągłego bloku
      blockEnd = hours[i] + 1;
    } else {
      // Przerwa — zamknij bieżący blok
      const day = Math.floor(blockStart / 24) + 1;
      shifts.push({
        personId,
        personName,
        day,
        startHour: blockStart % 24,
        endHour: blockEnd % 24 || 24,
        type: 'WORK',
      });
      blockStart = hours[i];
      blockEnd = hours[i] + 1;
    }
  }

  // Ostatni blok
  const day = Math.floor(blockStart / 24) + 1;
  shifts.push({
    personId,
    personName,
    day,
    startHour: blockStart % 24,
    endHour: blockEnd % 24 || 24,
    type: 'WORK',
  });

  return shifts;
}

/**
 * Generuje harmonogram pracy z granulacją 1-godzinną.
 * Praca może być rozbita w ciągu dnia — nie musi być ciągła.
 * Po przepracowaniu hoursPerShift godzin wymagana jest przerwa minBreakHours.
 * Każda osoba musi pracować co najmniej 1 godzinę każdego dnia.
 * W jednej godzinie może pracować wiele osób jednocześnie.
 */
export function generateSchedule(params: ScheduleParams): ScheduleResult {
  const { peopleCount, hoursPerShift, durationDays, minBreakHours, names = [], constraints = [] } = params;

  const errors: string[] = [];
  const coverageGaps: TimeGap[] = [];

  const personNames = Array.from({ length: peopleCount }, (_, i) =>
    names[i]?.trim() || `Osoba ${i + 1}`
  );

  // Constraint nocny
  const nightConstraint = constraints.find((c): c is NightShiftLimit => c.type === 'nightShiftLimit') ?? null;

  // Stan per osoba
  const hoursWorkedSinceBreak: number[] = new Array(peopleCount).fill(0);
  const lastWorkEnd: number[] = new Array(peopleCount).fill(-Infinity); // absolutna godzina końca ostatniej pracy
  const totalWorkHours: number[] = new Array(peopleCount).fill(0);

  // Wszystkie przydzielone godziny per osoba (absolutne)
  const workHoursByPerson: number[][] = Array.from({ length: peopleCount }, () => []);
  // Szybki lookup: absoluteHour → Set<personId>
  const hourAssignments = new Map<number, Set<number>>();

  function canPersonWorkHour(p: number, absoluteHour: number, hoursWorkedToday: number): boolean {
    const hour = absoluteHour % 24;

    // Osoba już przepracowała hoursPerShift dziś — nie przydzielaj więcej
    if (hoursWorkedToday >= hoursPerShift) return false;

    // Blokada osoby
    if (isPersonBlockedForHour(p, hour, constraints)) return false;

    // Sprawdź akumulator przerw
    if (lastWorkEnd[p] !== -Infinity) {
      const gap = absoluteHour - lastWorkEnd[p];

      if (gap >= minBreakHours) {
        // Naturalna przerwa — akumulator zresetuje się przy przydziale
      } else if (hoursWorkedSinceBreak[p] >= hoursPerShift) {
        // Obowiązkowa przerwa po przepracowaniu limitu — jeszcze trwa
        return false;
      }
      // Jeśli akumulator < limit i gap < minBreakHours — OK, może dalej pracować
    }

    // Limit nocny
    if (nightConstraint && isHourInRange(hour, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
      const assigned = hourAssignments.get(absoluteHour);
      const nightCount = assigned
        ? [...assigned].filter((pid) => pid !== p).length // nie licz samego siebie jeśli już tam jest
        : 0;
      // Zlicz ile osób jest przydzielonych do NOCNYCH godzin w tej samej godzinie
      const currentNightPeople = assigned ? assigned.size : 0;
      if (currentNightPeople >= nightConstraint.maxPeople) return false;
    }

    return true;
  }

  function assignWork(p: number, absoluteHour: number) {
    // Resetuj akumulator jeśli naturalna przerwa
    if (lastWorkEnd[p] !== -Infinity) {
      const gap = absoluteHour - lastWorkEnd[p];
      if (gap >= minBreakHours) {
        hoursWorkedSinceBreak[p] = 0;
      }
    } else {
      hoursWorkedSinceBreak[p] = 0;
    }

    hoursWorkedSinceBreak[p]++;
    lastWorkEnd[p] = absoluteHour + 1; // praca trwa od absoluteHour do absoluteHour+1
    totalWorkHours[p]++;
    workHoursByPerson[p].push(absoluteHour);

    if (!hourAssignments.has(absoluteHour)) {
      hourAssignments.set(absoluteHour, new Set());
    }
    hourAssignments.get(absoluteHour)!.add(p);
  }

  for (let day = 1; day <= durationDays; day++) {
    const hoursWorkedToday: number[] = new Array(peopleCount).fill(0);
    const workedToday: boolean[] = new Array(peopleCount).fill(false);

    for (let hour = 0; hour < 24; hour++) {
      const absoluteHour = (day - 1) * 24 + hour;

      // Znajdź dostępne osoby
      const available: number[] = [];
      for (let p = 0; p < peopleCount; p++) {
        if (canPersonWorkHour(p, absoluteHour, hoursWorkedToday[p])) {
          available.push(p);
        }
      }

      // Ile osób powinno pracować tę godzinę?
      // Cel: każda osoba pracuje hoursPerShift godzin/dzień
      let remainingPersonHours = 0;
      for (let p = 0; p < peopleCount; p++) {
        remainingPersonHours += Math.max(0, hoursPerShift - hoursWorkedToday[p]);
      }
      const remainingDayHours = 24 - hour;
      const targetThisHour = Math.max(1, Math.ceil(remainingPersonHours / remainingDayHours));

      if (available.length === 0) {
        // Sprawdź czy ktokolwiek już pracuje tę godzinę
        const assigned = hourAssignments.get(absoluteHour);
        if (!assigned || assigned.size === 0) {
          coverageGaps.push({ day, startHour: hour, endHour: hour + 1 });
        }
        continue;
      }

      // Sortuj: priorytet dla kontynuacji bloku, potem ci co nie pracowali dziś, potem najmniej godzin
      available.sort((a, b) => {
        // Preferuj osobę aktualnie w bloku (pracowała poprzednią godzinę)
        const aInBlock = lastWorkEnd[a] === absoluteHour;
        const bInBlock = lastWorkEnd[b] === absoluteHour;
        if (aInBlock !== bInBlock) return aInBlock ? -1 : 1;

        // Potem ci co jeszcze nie pracowali dziś
        if (workedToday[a] !== workedToday[b]) return workedToday[a] ? 1 : -1;

        // Potem wg najmniej godzin dziś
        if (hoursWorkedToday[a] !== hoursWorkedToday[b]) return hoursWorkedToday[a] - hoursWorkedToday[b];

        // Tiebreak: najmniej godzin łącznie
        return totalWorkHours[a] - totalWorkHours[b];
      });

      const toAssign = Math.min(targetThisHour, available.length);
      for (let i = 0; i < toAssign; i++) {
        const p = available[i];

        // Re-sprawdź limit nocny po wcześniejszych przydziałach w tej godzinie
        const hourMod = absoluteHour % 24;
        if (nightConstraint && isHourInRange(hourMod, nightConstraint.nightStartHour, nightConstraint.nightEndHour)) {
          const assigned = hourAssignments.get(absoluteHour);
          if (assigned && assigned.size >= nightConstraint.maxPeople) break;
        }

        assignWork(p, absoluteHour);
        hoursWorkedToday[p]++;
        workedToday[p] = true;
      }
    }

    // Sprawdź czy każda osoba pracowała dziś
    for (let p = 0; p < peopleCount; p++) {
      if (!workedToday[p]) {
        errors.push(
          `${personNames[p]} nie ma przydzielonej pracy w dniu ${day} — brak dostępnych godzin (przerwa/ograniczenia).`
        );
      }
    }
  }

  // Sprawdź pokrycie — każda godzina każdego dnia musi mieć co najmniej 1 osobę
  for (let day = 1; day <= durationDays; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const absoluteHour = (day - 1) * 24 + hour;
      const assigned = hourAssignments.get(absoluteHour);
      if (!assigned || assigned.size === 0) {
        // Dodaj tylko jeśli jeszcze nie dodano
        const alreadyGap = coverageGaps.some(
          (g) => g.day === day && g.startHour === hour
        );
        if (!alreadyGap) {
          coverageGaps.push({ day, startHour: hour, endHour: hour + 1 });
        }
      }
    }
  }

  // Scal godziny w ciągłe zmiany (Shift) per osoba
  const shifts: Shift[] = [];
  for (let p = 0; p < peopleCount; p++) {
    workHoursByPerson[p].sort((a, b) => a - b);
    shifts.push(...mergeHoursIntoShifts(p, personNames[p], workHoursByPerson[p]));
  }

  // Oblicz statystyki
  const stats: PersonStats[] = personNames.map((name, i) => {
    const personShifts = shifts.filter((s) => s.personId === i);
    // Oblicz minimalną przerwę między zmianami
    let minBreak = Infinity;
    const sortedShifts = personShifts.sort((a, b) => {
      const absA = (a.day - 1) * 24 + a.startHour;
      const absB = (b.day - 1) * 24 + b.startHour;
      return absA - absB;
    });
    for (let s = 0; s < sortedShifts.length - 1; s++) {
      const endAbs = (sortedShifts[s].day - 1) * 24 + sortedShifts[s].endHour;
      const startAbs = (sortedShifts[s + 1].day - 1) * 24 + sortedShifts[s + 1].startHour;
      const gap = startAbs - endAbs;
      if (gap > 0 && gap < minBreak) minBreak = gap;
    }

    return {
      personId: i,
      personName: name,
      totalWorkHours: totalWorkHours[i],
      shiftsCount: personShifts.length,
      minBreakActual: minBreak === Infinity ? 0 : minBreak,
    };
  });

  const valid = coverageGaps.length === 0 && errors.length === 0;

  return { shifts, valid, errors, coverageGaps, stats };
}
