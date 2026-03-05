import type { ScheduleResult } from '@/types/schedule';

export function generateCSV(result: ScheduleResult, durationDays: number, hoursPerShift: number): string {
  const shiftsPerDay = Math.floor(24 / hoursPerShift);
  const blocks = Array.from({ length: shiftsPerDay }, (_, i) => ({
    start: i * hoursPerShift,
    end: (i + 1) * hoursPerShift,
  }));

  // Nagłówki
  const headers = ['Osoba'];
  for (let d = 1; d <= durationDays; d++) {
    for (const block of blocks) {
      headers.push(`Dzień ${d} ${block.start}:00-${block.end}:00`);
    }
  }

  const persons = result.stats.map((s) => ({ id: s.personId, name: s.personName }));
  const shiftMap = new Map<string, number>();
  for (const shift of result.shifts) {
    shiftMap.set(`${shift.day}-${shift.startHour}`, shift.personId);
  }

  const rows = persons.map((person) => {
    const cells = [person.name];
    for (let d = 1; d <= durationDays; d++) {
      for (const block of blocks) {
        const assignedId = shiftMap.get(`${d}-${block.start}`);
        cells.push(assignedId === person.id ? 'PRACA' : '');
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
