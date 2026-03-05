'use client';

import type { ScheduleResult } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScheduleTableProps {
  result: ScheduleResult;
  durationDays: number;
  hoursPerShift: number;
}

export function ScheduleTable({ result, durationDays, hoursPerShift }: ScheduleTableProps) {
  const shiftsPerDay = Math.floor(24 / hoursPerShift);
  const blocks = Array.from({ length: shiftsPerDay }, (_, i) => ({
    start: i * hoursPerShift,
    end: (i + 1) * hoursPerShift,
  }));

  // Unikalne osoby
  const persons = result.stats.map((s) => ({
    id: s.personId,
    name: s.personName,
  }));

  // Mapuj zmiany do szybkiego lookup: klucz = `${day}-${startHour}`
  const shiftMap = new Map<string, typeof result.shifts[0]>();
  for (const shift of result.shifts) {
    shiftMap.set(`${shift.day}-${shift.startHour}`, shift);
  }

  // Sprawdź luki
  const gapSet = new Set(
    result.coverageGaps.map((g) => `${g.day}-${g.startHour}`)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Harmonogram zmian</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border p-2 bg-muted text-left sticky left-0 z-10" rowSpan={2}>
                  Osoba
                </th>
                {Array.from({ length: durationDays }, (_, d) => (
                  <th
                    key={d}
                    className="border border-border p-2 bg-muted text-center"
                    colSpan={shiftsPerDay}
                  >
                    Dzień {d + 1}
                  </th>
                ))}
              </tr>
              <tr>
                {Array.from({ length: durationDays }, (_, d) =>
                  blocks.map((block) => (
                    <th
                      key={`${d}-${block.start}`}
                      className="border border-border p-1 bg-muted/50 text-center text-xs font-normal"
                    >
                      {block.start}:00–{block.end}:00
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {persons.map((person) => (
                <tr key={person.id}>
                  <td className="border border-border p-2 font-medium sticky left-0 bg-background z-10 whitespace-nowrap">
                    {person.name}
                  </td>
                  {Array.from({ length: durationDays }, (_, d) =>
                    blocks.map((block) => {
                      const key = `${d + 1}-${block.start}`;
                      const shift = shiftMap.get(key);
                      const isGap = gapSet.has(key);
                      const isWork = shift?.personId === person.id;

                      let cellClass = 'bg-gray-100 dark:bg-gray-800'; // odpoczynek
                      let cellContent = '';

                      if (isWork) {
                        cellClass = 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200';
                        cellContent = `${block.start}:00–${block.end}:00`;
                      } else if (isGap) {
                        cellClass = 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200';
                        cellContent = 'LUKA';
                      }

                      return (
                        <td
                          key={`${d}-${block.start}`}
                          className={`border border-border p-1 text-center text-xs ${cellClass}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tabela statystyk per osoba */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Statystyki per osoba</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted text-left">Osoba</th>
                  <th className="border border-border p-2 bg-muted text-center">Zmian</th>
                  <th className="border border-border p-2 bg-muted text-center">Łącznie godzin</th>
                  <th className="border border-border p-2 bg-muted text-center">Min. przerwa</th>
                </tr>
              </thead>
              <tbody>
                {result.stats.map((stat) => (
                  <tr key={stat.personId}>
                    <td className="border border-border p-2">{stat.personName}</td>
                    <td className="border border-border p-2 text-center">{stat.shiftsCount}</td>
                    <td className="border border-border p-2 text-center">{stat.totalWorkHours}h</td>
                    <td className="border border-border p-2 text-center">
                      {stat.shiftsCount > 1 ? `${stat.minBreakActual}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
