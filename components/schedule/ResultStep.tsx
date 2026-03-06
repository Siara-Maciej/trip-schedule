'use client';

import { ArrowLeft, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { PlanResult, WorkingHoursConfig, StaffConstraints } from '@/types/schedule-plan';

const SHIFT_COLORS = [
  'bg-violet-500',
  'bg-pink-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-teal-500',
];

interface ResultStepProps {
  result: PlanResult;
  workingHours: WorkingHoursConfig;
  constraints: StaffConstraints;
  onBack: () => void;
  onReset: () => void;
}

export function ResultStep({ result, workingHours, onBack, onReset }: ResultStepProps) {
  // Group shifts by date
  const byDate = new Map<string, typeof result.shifts>();
  for (const shift of result.shifts) {
    const arr = byDate.get(shift.date) ?? [];
    arr.push(shift);
    byDate.set(shift.date, arr);
  }

  // Determine timeline range
  let minH = 24, maxH = 0;
  for (const shift of result.shifts) {
    if (shift.startHour < minH) minH = shift.startHour;
    if (shift.endHour > maxH) maxH = shift.endHour;
  }
  if (minH >= maxH) { minH = 0; maxH = 24; }
  const totalRange = maxH - minH;

  // Person color map
  const personIds = [...new Set(result.shifts.map((s) => s.personId))];
  const colorMap = new Map<string, string>();
  personIds.forEach((id, i) => colorMap.set(id, SHIFT_COLORS[i % SHIFT_COLORS.length]));

  // Per-person summary
  const personHours = new Map<string, { name: string; hours: number; shifts: number }>();
  for (const shift of result.shifts) {
    const existing = personHours.get(shift.personId) ?? { name: shift.personName, hours: 0, shifts: 0 };
    existing.hours += shift.endHour - shift.startHour;
    existing.shifts += 1;
    personHours.set(shift.personId, existing);
  }

  const handleExportCSV = () => {
    const header = 'Data,Dzień,Zmiana,Osoba,Od,Do,Godziny\n';
    const rows = result.shifts.map((s) =>
      `${s.date},${s.dayLabel},${s.shiftName},${s.personName},${s.startHour}:00,${s.endHour}:00,${s.endHour - s.startHour}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grafik-${result.daysCount}dni.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uwagi ({result.warnings.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4 text-sm">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{result.daysCount}</div>
            <p className="text-sm text-muted-foreground">Dni</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{result.shifts.length}</div>
            <p className="text-sm text-muted-foreground">Zmian</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{personIds.length}</div>
            <p className="text-sm text-muted-foreground">Osób</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{result.totalHours}h</div>
            <p className="text-sm text-muted-foreground">Łącznie godzin</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Grafik</CardTitle>
            <CardDescription>Widok osi czasu</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Hour header */}
            <div className="flex items-end gap-2">
              <div className="w-24 shrink-0 sm:w-32" />
              <div className="relative flex h-5 flex-1">
                {Array.from({ length: totalRange + 1 }, (_, i) => (
                  <span
                    key={i}
                    className="absolute text-xs text-muted-foreground"
                    style={{
                      left: `${(i / totalRange) * 100}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {minH + i}
                  </span>
                ))}
              </div>
            </div>

            {/* Day rows */}
            {[...byDate.entries()].map(([date, shifts]) => (
              <div key={date} className="flex items-center gap-2">
                <div className="w-24 shrink-0 text-right text-xs font-medium sm:w-32 sm:text-sm">
                  {shifts[0].dayLabel}
                </div>
                <div className="relative h-9 flex-1 rounded-md bg-muted/50">
                  {shifts.map((shift, i) => {
                    const left = ((shift.startHour - minH) / totalRange) * 100;
                    const width = ((shift.endHour - shift.startHour) / totalRange) * 100;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0.5 h-8 rounded-md ${colorMap.get(shift.personId) ?? 'bg-primary'} flex items-center px-1.5 text-xs font-medium text-white shadow-sm`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 2)}%`,
                        }}
                        title={`${shift.personName} — ${shift.shiftName} (${shift.startHour}:00–${shift.endHour}:00)`}
                      >
                        <span className="truncate">{shift.personName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-2">
            {personIds.map((id) => {
              const info = personHours.get(id);
              return (
                <div key={id} className="flex items-center gap-1.5">
                  <div className={`h-3 w-3 rounded-sm ${colorMap.get(id)}`} />
                  <span className="text-xs text-muted-foreground">
                    {info?.name}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-person summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Podsumowanie na osobę</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...personHours.entries()].map(([id, info]) => (
              <div
                key={id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className={`h-8 w-8 rounded-full ${colorMap.get(id)} flex items-center justify-center text-xs font-bold text-white`}>
                  {info.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{info.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {info.hours}h &middot; {info.shifts} zmian
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Wróć do osób
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Nowy grafik
        </Button>
      </div>
    </div>
  );
}
