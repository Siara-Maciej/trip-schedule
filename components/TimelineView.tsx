'use client';

import type { ScheduleResult } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimelineViewProps {
  result: ScheduleResult;
  durationDays: number;
  hoursPerShift: number;
}

// Paleta kolorów dla osób
const PERSON_COLORS = [
  { bg: 'bg-blue-400 dark:bg-blue-600', text: 'text-white' },
  { bg: 'bg-emerald-400 dark:bg-emerald-600', text: 'text-white' },
  { bg: 'bg-amber-400 dark:bg-amber-600', text: 'text-white' },
  { bg: 'bg-purple-400 dark:bg-purple-600', text: 'text-white' },
  { bg: 'bg-rose-400 dark:bg-rose-600', text: 'text-white' },
  { bg: 'bg-cyan-400 dark:bg-cyan-600', text: 'text-white' },
  { bg: 'bg-orange-400 dark:bg-orange-600', text: 'text-white' },
  { bg: 'bg-indigo-400 dark:bg-indigo-600', text: 'text-white' },
  { bg: 'bg-pink-400 dark:bg-pink-600', text: 'text-white' },
  { bg: 'bg-teal-400 dark:bg-teal-600', text: 'text-white' },
];

export function TimelineView({ result, durationDays, hoursPerShift }: TimelineViewProps) {
  const hours = Array.from({ length: 25 }, (_, i) => i); // 0-24

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Oś czasu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: durationDays }, (_, dayIdx) => {
            const day = dayIdx + 1;
            const dayShifts = result.shifts.filter((s) => s.day === day);

            return (
              <div key={day}>
                <p className="text-sm font-medium mb-1">Dzień {day}</p>
                <div className="relative h-10 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  {/* Linie godzinowe */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-gray-300 dark:border-gray-600"
                      style={{ left: `${(h / 24) * 100}%` }}
                    />
                  ))}
                  {/* Bloki zmian */}
                  {dayShifts.map((shift, i) => {
                    const color = PERSON_COLORS[shift.personId % PERSON_COLORS.length];
                    const left = (shift.startHour / 24) * 100;
                    const width = ((shift.endHour - shift.startHour) / 24) * 100;

                    return (
                      <div
                        key={i}
                        className={`absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center text-xs font-medium ${color.bg} ${color.text} transition-all`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${shift.personName}: ${shift.startHour}:00–${shift.endHour}:00`}
                      >
                        <span className="truncate px-1">{shift.personName}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Etykiety godzin */}
                <div className="relative h-4 text-[10px] text-muted-foreground">
                  {[0, 6, 12, 18, 24].map((h) => (
                    <span
                      key={h}
                      className="absolute"
                      style={{ left: `${(h / 24) * 100}%`, transform: 'translateX(-50%)' }}
                    >
                      {h}:00
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
          {result.stats.map((stat) => {
            const color = PERSON_COLORS[stat.personId % PERSON_COLORS.length];
            return (
              <div key={stat.personId} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${color.bg}`} />
                <span className="text-xs">{stat.personName}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
