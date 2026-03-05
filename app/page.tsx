'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ScheduleForm } from '@/components/ScheduleForm';
import { ScheduleTable } from '@/components/ScheduleTable';
import { TimelineView } from '@/components/TimelineView';
import { StatsCards } from '@/components/StatsCards';
import { CoverageAlert } from '@/components/CoverageAlert';
import { ConstraintsEditor } from '@/components/ConstraintsEditor';
import { PersonCreator } from '@/components/PersonCreator';
import { Button } from '@/components/ui/button';
import { generateSchedule } from '@/lib/scheduler';
import { generateCSV, downloadCSV } from '@/lib/csv-export';
import type { ScheduleFormData } from '@/lib/validation';
import type { ScheduleResult, ScheduleConstraint, PersonConfig } from '@/types/schedule';

const STORAGE_KEY = 'schedule-params';
const PERSONS_KEY = 'schedule-persons';
const NIGHT_KEY = 'schedule-night';

interface NightWorkConfig {
  enabled: boolean;
  nightStartHour: number;
  nightEndHour: number;
}

function getStoredDuration(): number {
  if (typeof window === 'undefined') return 4;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.durationDays ?? 4;
    }
  } catch { /* ignoruj */ }
  return 4;
}

function getStoredPersons(): PersonConfig[] {
  if (typeof window === 'undefined') return getDefaultPersons();
  try {
    const stored = localStorage.getItem(PERSONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    }
  } catch { /* ignoruj */ }
  return getDefaultPersons();
}

function getDefaultPersons(): PersonConfig[] {
  return Array.from({ length: 4 }, () => ({
    name: '',
    hoursPerShift: 8,
    minBreakHours: 11,
    blockedHours: null,
    canWorkAtNight: true,
  }));
}

function getStoredNight(): NightWorkConfig {
  if (typeof window === 'undefined') return { enabled: false, nightStartHour: 22, nightEndHour: 6 };
  try {
    const stored = localStorage.getItem(NIGHT_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignoruj */ }
  return { enabled: false, nightStartHour: 22, nightEndHour: 6 };
}

/** Konwertuj PersonConfig[] + nightConfig na constrainty schedulera */
function buildConstraints(
  persons: PersonConfig[],
  nightWork: NightWorkConfig,
): ScheduleConstraint[] {
  const constraints: ScheduleConstraint[] = [];

  // Night shift limit — gdy włączone, wymagamy max peopleCount (bez limitu), ale osoby z canWorkAtNight=false są blokowane
  if (nightWork.enabled) {
    for (let i = 0; i < persons.length; i++) {
      if (!persons[i].canWorkAtNight) {
        constraints.push({
          type: 'personBlocked',
          personId: i,
          startHour: nightWork.nightStartHour,
          endHour: nightWork.nightEndHour,
        });
      }
    }
  } else {
    // Brak wymaganej pracy w nocy — blokuj nocne godziny dla wszystkich
    // (ale nie blokujemy — bo nie mamy domyślnego zakresu)
  }

  // Per-person blocked hours
  for (let i = 0; i < persons.length; i++) {
    const p = persons[i];
    if (p.blockedHours) {
      constraints.push({
        type: 'personBlocked',
        personId: i,
        startHour: p.blockedHours.startHour,
        endHour: p.blockedHours.endHour,
      });
    }
  }

  return constraints;
}

function SchedulePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData | null>(null);
  const [visible, setVisible] = useState(false);
  const [persons, setPersons] = useState<PersonConfig[]>(getStoredPersons);
  const [nightWork, setNightWork] = useState<NightWorkConfig>(getStoredNight);

  const defaultValues: Partial<ScheduleFormData> = (() => {
    const d = searchParams.get('days');
    if (d) return { durationDays: Number(d) };
    return { durationDays: getStoredDuration() };
  })();

  const handlePersonsChange = useCallback((newPersons: PersonConfig[]) => {
    setPersons(newPersons);
    try { localStorage.setItem(PERSONS_KEY, JSON.stringify(newPersons)); } catch { /* ignoruj */ }
  }, []);

  const handleNightChange = useCallback((config: NightWorkConfig) => {
    setNightWork(config);
    try { localStorage.setItem(NIGHT_KEY, JSON.stringify(config)); } catch { /* ignoruj */ }
  }, []);

  const handleSubmit = useCallback((data: ScheduleFormData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignoruj */ }

    const urlParams = new URLSearchParams();
    urlParams.set('days', String(data.durationDays));
    router.replace(`?${urlParams.toString()}`, { scroll: false });

    const peopleCount = persons.length;
    const names = persons.map((p, i) => p.name.trim() || `Osoba ${i + 1}`);
    const constraints = buildConstraints(persons, nightWork);

    const scheduleResult = generateSchedule({
      peopleCount,
      durationDays: data.durationDays,
      names,
      perPersonShiftHours: persons.map((p) => p.hoursPerShift),
      perPersonMinBreak: persons.map((p) => p.minBreakHours),
      constraints,
    });

    setResult(scheduleResult);
    setFormData(data);
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
  }, [router, persons, nightWork]);

  const handleExportCSV = () => {
    if (!result || !formData) return;
    const csv = generateCSV(result, formData.durationDays);
    downloadCSV(csv, `harmonogram-${formData.durationDays}dni.csv`);
  };

  // Avg shift for display
  const avgShift = persons.length > 0
    ? Math.round(persons.reduce((s, p) => s + p.hoursPerShift, 0) / persons.length)
    : 8;

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

        <PersonCreator persons={persons} onChange={handlePersonsChange} />

        <ConstraintsEditor nightWork={nightWork} onChange={handleNightChange} />

        {result && formData && (
          <div
            className={`space-y-6 transition-opacity duration-500 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <CoverageAlert result={result} />

            <StatsCards
              result={result}
              durationDays={formData.durationDays}
              hoursPerShift={avgShift}
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleExportCSV}>
                Pobierz CSV
              </Button>
            </div>

            <ScheduleTable
              result={result}
              durationDays={formData.durationDays}
              hoursPerShift={avgShift}
            />

            <TimelineView
              result={result}
              durationDays={formData.durationDays}
              hoursPerShift={avgShift}
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
