'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { ClinicScheduleResult, ClinicConfig } from '@/types/clinic';

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

const ROLE_COLORS: Record<string, string> = {
  lekarz: 'bg-violet-500',
  pielegniarka: 'bg-pink-500',
  rejestratorka: 'bg-sky-500',
  technik: 'bg-amber-500',
  inny: 'bg-gray-500',
};

interface ClinicScheduleViewProps {
  result: ClinicScheduleResult;
  config: ClinicConfig;
}

export function ClinicScheduleView({ result, config }: ClinicScheduleViewProps) {
  const openH = parseInt(config.openTime.split(':')[0], 10);
  const closeH = parseInt(config.closeTime.split(':')[0], 10);
  const totalHours = closeH - openH;

  const workDays = [...config.workDays].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {result.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uwagi</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grafik tygodniowy</CardTitle>
          <CardDescription>{result.weekLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Hour header */}
            <div className="flex items-end gap-2">
              <div className="w-28 shrink-0" />
              <div className="relative flex flex-1">
                {Array.from({ length: totalHours + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="text-xs text-muted-foreground"
                    style={{
                      position: 'absolute',
                      left: `${(i / totalHours) * 100}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {openH + i}:00
                  </div>
                ))}
              </div>
            </div>

            {/* Day rows */}
            {workDays.map((day) => {
              const dayShifts = result.shifts.filter((s) => s.day === day);
              return (
                <div key={day} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 text-right text-sm font-medium">
                    {DAYS[day]}
                  </div>
                  <div className="relative h-10 flex-1 rounded-md bg-muted/50">
                    {dayShifts.map((shift, i) => {
                      const left = ((shift.startHour - openH) / totalHours) * 100;
                      const width =
                        ((shift.endHour - shift.startHour) / totalHours) * 100;
                      return (
                        <div
                          key={i}
                          className={`absolute top-0.5 h-9 rounded-md ${ROLE_COLORS[shift.role] ?? 'bg-primary'} flex items-center px-2 text-xs font-medium text-white shadow-sm transition-all hover:brightness-110`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: '2rem',
                          }}
                          title={`${shift.employeeName} (${shift.startHour}:00–${shift.endHour}:00)`}
                        >
                          <span className="truncate">{shift.employeeName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-3">
            {Object.entries(ROLE_COLORS).map(([role, color]) => (
              <div key={role} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded-sm ${color}`} />
                <span className="text-xs text-muted-foreground capitalize">{role}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{result.shifts.length}</div>
            <p className="text-sm text-muted-foreground">Zmian zaplanowanych</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {new Set(result.shifts.map((s) => s.employeeId)).size}
            </div>
            <p className="text-sm text-muted-foreground">Pracowników w grafiku</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {result.shifts.reduce((sum, s) => sum + (s.endHour - s.startHour), 0)}h
            </div>
            <p className="text-sm text-muted-foreground">Łącznie godzin</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
