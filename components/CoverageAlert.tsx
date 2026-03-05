'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ScheduleResult } from '@/types/schedule';

interface CoverageAlertProps {
  result: ScheduleResult;
}

export function CoverageAlert({ result }: CoverageAlertProps) {
  if (result.valid && result.coverageGaps.length === 0) {
    return (
      <Alert className="border-green-500/50 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
        <AlertTitle>Harmonogram poprawny</AlertTitle>
        <AlertDescription>
          Wszystkie bloki czasowe zostały obsadzone. Wszystkie przerwy spełniają wymagania.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {result.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Błędy w harmonogramie</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {result.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {result.coverageGaps.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>Luki w pokryciu</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {result.coverageGaps.map((gap, i) => (
                <li key={i}>
                  Dzień {gap.day}: {gap.startHour}:00–{gap.endHour}:00 — brak obsady
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
