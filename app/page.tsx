'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ScheduleForm } from '@/components/ScheduleForm';
import { ScheduleTable } from '@/components/ScheduleTable';
import { TimelineView } from '@/components/TimelineView';
import { StatsCards } from '@/components/StatsCards';
import { CoverageAlert } from '@/components/CoverageAlert';
import { ConstraintsEditor } from '@/components/ConstraintsEditor';
import { Button } from '@/components/ui/button';
import { generateSchedule } from '@/lib/scheduler';
import { generateCSV, downloadCSV } from '@/lib/csv-export';
import type { ScheduleFormData } from '@/lib/validation';
import type { ScheduleResult, ScheduleConstraint } from '@/types/schedule';

const STORAGE_KEY = 'schedule-params';
const CONSTRAINTS_KEY = 'schedule-constraints';

function getDefaultValues(): Partial<ScheduleFormData> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignoruj
  }
  return {};
}

function getStoredConstraints(): ScheduleConstraint[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CONSTRAINTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignoruj
  }
  return [];
}

function SchedulePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [params, setParams] = useState<ScheduleFormData | null>(null);
  const [visible, setVisible] = useState(false);
  const [constraints, setConstraints] = useState<ScheduleConstraint[]>(getStoredConstraints);
  // Przechowuj liczbę osób i imiona do wyświetlania w edytorze ograniczeń
  const [currentPeopleCount, setCurrentPeopleCount] = useState(4);
  const [currentNames, setCurrentNames] = useState<string[]>([]);

  const defaultValues: Partial<ScheduleFormData> = (() => {
    const fromUrl: Partial<ScheduleFormData> = {};
    const p = searchParams.get('people');
    const h = searchParams.get('hours');
    const d = searchParams.get('days');
    const b = searchParams.get('break');
    const n = searchParams.get('names');
    if (p) fromUrl.peopleCount = Number(p);
    if (h) fromUrl.hoursPerShift = Number(h);
    if (d) fromUrl.durationDays = Number(d);
    if (b) fromUrl.minBreakHours = Number(b);
    if (n) fromUrl.customNames = n;

    if (Object.keys(fromUrl).length > 0) return fromUrl;
    return getDefaultValues();
  })();

  const handleConstraintsChange = useCallback((newConstraints: ScheduleConstraint[]) => {
    setConstraints(newConstraints);
    try {
      localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(newConstraints));
    } catch {
      // ignoruj
    }
  }, []);

  const handleSubmit = useCallback((data: ScheduleFormData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignoruj
    }

    const urlParams = new URLSearchParams();
    urlParams.set('people', String(data.peopleCount));
    urlParams.set('hours', String(data.hoursPerShift));
    urlParams.set('days', String(data.durationDays));
    urlParams.set('break', String(data.minBreakHours));
    if (data.customNames) urlParams.set('names', data.customNames);
    router.replace(`?${urlParams.toString()}`, { scroll: false });

    const names = data.customNames
      ? data.customNames.split(',').map((n) => n.trim()).filter(Boolean)
      : [];

    setCurrentPeopleCount(data.peopleCount);
    setCurrentNames(names);

    const scheduleResult = generateSchedule({
      peopleCount: data.peopleCount,
      hoursPerShift: data.hoursPerShift,
      durationDays: data.durationDays,
      minBreakHours: data.minBreakHours,
      names,
      constraints,
    });

    setResult(scheduleResult);
    setParams(data);
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
  }, [router, constraints]);

  const handleExportCSV = () => {
    if (!result || !params) return;
    const csv = generateCSV(result, params.durationDays, params.hoursPerShift);
    downloadCSV(csv, `harmonogram-${params.durationDays}dni.csv`);
  };

  const effectivePeopleCount = params?.peopleCount ?? defaultValues.peopleCount ?? currentPeopleCount;
  const effectiveNames = currentNames.length > 0
    ? currentNames
    : (defaultValues.customNames?.split(',').map((n) => n.trim()).filter(Boolean) ?? []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Generator Harmonogramu Pracy
          </h1>
          <p className="text-muted-foreground">
            Wycieczka &middot; Planowanie zmian
          </p>
        </div>

        <ScheduleForm onSubmit={handleSubmit} defaultValues={defaultValues} />

        <ConstraintsEditor
          peopleCount={effectivePeopleCount}
          personNames={effectiveNames}
          constraints={constraints}
          onChange={handleConstraintsChange}
        />

        {result && params && (
          <div
            className={`space-y-6 transition-opacity duration-500 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <CoverageAlert result={result} />

            <StatsCards
              result={result}
              durationDays={params.durationDays}
              hoursPerShift={params.hoursPerShift}
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleExportCSV}>
                Pobierz CSV
              </Button>
            </div>

            <ScheduleTable
              result={result}
              durationDays={params.durationDays}
              hoursPerShift={params.hoursPerShift}
            />

            <TimelineView
              result={result}
              durationDays={params.durationDays}
              hoursPerShift={params.hoursPerShift}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Ładowanie...</div>}>
      <SchedulePage />
    </Suspense>
  );
}
