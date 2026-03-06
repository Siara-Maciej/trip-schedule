'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ScheduleResult } from '@/types/schedule';

interface StatsCardsProps {
  result: ScheduleResult;
  durationDays: number;
  hoursPerShift: number;
}

export function StatsCards({ result, durationDays }: StatsCardsProps) {
  const totalHours = durationDays * 24;
  const coveredHours = totalHours - result.coverageGaps.length;
  const coveragePercent = totalHours > 0
    ? Math.round((coveredHours / totalHours) * 100)
    : 0;

  const totalWorkHours = result.stats.reduce((sum, s) => sum + s.totalWorkHours, 0);

  const statsItems = [
    { label: 'Pokrycie godzin', value: `${coveragePercent}%`, color: coveragePercent === 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
    { label: 'Osoby', value: `${result.stats.length}` },
    { label: 'Łącznie roboczogodzin', value: `${totalWorkHours}h` },
    { label: 'Bloków pracy', value: `${result.shifts.length}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color || ''}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
