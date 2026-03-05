'use client';

import type { ScheduleResult } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScheduleTableProps {
  result: ScheduleResult;
  durationDays: number;
  hoursPerShift: number;
}

export function ScheduleTable({ result, durationDays }: ScheduleTableProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const persons = result.stats.map((s) => ({
    id: s.personId,
    name: s.personName,
  }));

  // Zbuduj Set pracujących godzin per osoba: `${personId}-${day}-${hour}`
  const workSet = new Set<string>();
  for (const shift of result.shifts) {
    for (let h = shift.startHour; h < shift.endHour; h++) {
      workSet.add(`${shift.personId}-${shift.day}-${h}`);
    }
  }

  // Luki pokrycia
  const gapSet = new Set<string>();
  for (const g of result.coverageGaps) {
    for (let h = g.startHour; h < g.endHour; h++) {
      gapSet.add(`${g.day}-${h}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Harmonogram zmian</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-border p-1 bg-muted text-left sticky left-0 z-10 min-w-[80px]" rowSpan={2}>
                  Osoba
                </th>
                {Array.from({ length: durationDays }, (_, d) => (
                  <th
                    key={d}
                    className="border border-border p-1 bg-muted text-center"
                    colSpan={24}
                  >
                    Dzień {d + 1}
                  </th>
                ))}
              </tr>
              <tr>
                {Array.from({ length: durationDays }, (_, d) =>
                  hours.map((h) => (
                    <th
                      key={`${d}-${h}`}
                      className="border border-border px-0 py-0.5 bg-muted/50 text-center font-normal w-5 min-w-5"
                    >
                      {h}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {persons.map((person) => (
                <tr key={person.id}>
                  <td className="border border-border p-1 font-medium sticky left-0 bg-background z-10 whitespace-nowrap">
                    {person.name}
                  </td>
                  {Array.from({ length: durationDays }, (_, d) =>
                    hours.map((h) => {
                      const day = d + 1;
                      const isWork = workSet.has(`${person.id}-${day}-${h}`);
                      const isGap = gapSet.has(`${day}-${h}`);

                      let cellClass = 'bg-gray-100 dark:bg-gray-800';
                      if (isWork) {
                        cellClass = 'bg-green-300 dark:bg-green-800';
                      } else if (isGap) {
                        cellClass = 'bg-red-300 dark:bg-red-800';
                      }

                      return (
                        <td
                          key={`${d}-${h}`}
                          className={`border border-border p-0 w-5 min-w-5 h-5 ${cellClass}`}
                          title={
                            isWork
                              ? `${person.name}: ${h}:00–${h + 1}:00`
                              : isGap
                                ? `LUKA: ${h}:00–${h + 1}:00`
                                : ''
                          }
                        />
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-green-300 dark:bg-green-800 rounded-sm" /> Praca
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded-sm border border-border" /> Odpoczynek
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-red-300 dark:bg-red-800 rounded-sm" /> Luka
          </span>
        </div>

        {/* Tabela statystyk per osoba */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Statystyki per osoba</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted text-left">Osoba</th>
                  <th className="border border-border p-2 bg-muted text-center">Bloków pracy</th>
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
