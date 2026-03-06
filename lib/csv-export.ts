import type { ScheduleResult } from '@/types/schedule';

export function generateCSV(result: ScheduleResult, durationDays: number): string {
  // Nagłówki: Osoba, Dzień 1 0:00, Dzień 1 1:00, ..., Dzień 1 23:00, Dzień 2 0:00, ...
  const headers = ['Osoba'];
  for (let d = 1; d <= durationDays; d++) {
    for (let h = 0; h < 24; h++) {
      headers.push(`Dzień ${d} ${h}:00`);
    }
  }

  // Zbuduj set pracujących godzin per osoba
  const workSet = new Set<string>();
  for (const shift of result.shifts) {
    for (let h = shift.startHour; h < shift.endHour; h++) {
      workSet.add(`${shift.personId}-${shift.day}-${h}`);
    }
  }

  const persons = result.stats.map((s) => ({ id: s.personId, name: s.personName }));

  const rows = persons.map((person) => {
    const cells = [person.name];
    for (let d = 1; d <= durationDays; d++) {
      for (let h = 0; h < 24; h++) {
        cells.push(workSet.has(`${person.id}-${d}-${h}`) ? 'PRACA' : '');
      }
    }
    return cells.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
