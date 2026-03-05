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
const CONSTRAINTS_KEY = 'schedule-constraints';
const PERSONS_KEY = 'schedule-persons';

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

function getStoredPersons(): PersonConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PERSONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignoruj
  }
  return [];
}

/** Konwertuj PersonConfig[] na constrainty schedulera */
function personsToConstraints(persons: PersonConfig[], nightStart: number, nightEnd: number): ScheduleConstraint[] {
  const constraints: ScheduleConstraint[] = [];
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
    if (!p.canWorkAtNight) {
      constraints.push({
        type: 'personBlocked',
        personId: i,
        startHour: nightStart,
        endHour: nightEnd,
      });
    }
  }
  return constraints;
}

function SchedulePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [params, setParams] = useState<ScheduleFormData | null>(null);
  const [visible, setVisible] = useState(false);
  const [constraints, setConstraints] = useState<ScheduleConstraint[]>(getStoredConstraints);
  const [persons, setPersons] = useState<PersonConfig[]>(getStoredPersons);
  const [currentPeopleCount, setCurrentPeopleCount] = useState(
    () => getDefaultValues().peopleCount ?? 4
  );

  // Godziny nocne — z constraintu lub domyślne
  const nightConstraint = constraints.find((c) => c.type === 'nightShiftLimit');
  const nightStartHour = nightConstraint?.type === 'nightShiftLimit' ? nightConstraint.nightStartHour : 22;
  const nightEndHour = nightConstraint?.type === 'nightShiftLimit' ? nightConstraint.nightEndHour : 6;

  const defaultValues: Partial<ScheduleFormData> = (() => {
    const fromUrl: Partial<ScheduleFormData> = {};
    const p = searchParams.get('people');
    const h = searchParams.get('hours');
    const d = searchParams.get('days');
    const b = searchParams.get('break');
    if (p) fromUrl.peopleCount = Number(p);
    if (h) fromUrl.hoursPerShift = Number(h);
    if (d) fromUrl.durationDays = Number(d);
    if (b) fromUrl.minBreakHours = Number(b);

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

  const handlePersonsChange = useCallback((newPersons: PersonConfig[]) => {
    setPersons(newPersons);
    try {
      localStorage.setItem(PERSONS_KEY, JSON.stringify(newPersons));
    } catch {
      // ignoruj
    }
  }, []);

  const handlePeopleCountChange = useCallback((count: number) => {
    setCurrentPeopleCount(count);
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
    router.replace(`?${urlParams.toString()}`, { scroll: false });

    setCurrentPeopleCount(data.peopleCount);

    // Nazwy z kreatora osób
    const effectivePersons = persons.slice(0, data.peopleCount);
    const names = effectivePersons.map((p, i) =>
      p.name.trim() || `Osoba ${i + 1}`
    );

    // Constrainty: globalne + z kreatora osób
    const personConstraints = personsToConstraints(effectivePersons, nightStartHour, nightEndHour);
    const allConstraints = [...constraints, ...personConstraints];

    const scheduleResult = generateSchedule({
      peopleCount: data.peopleCount,
      hoursPerShift: data.hoursPerShift,
      durationDays: data.durationDays,
      minBreakHours: data.minBreakHours,
      names,
      constraints: allConstraints,
    });

    setResult(scheduleResult);
    setParams(data);
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
  }, [router, constraints, persons, nightStartHour, nightEndHour]);

  const handleExportCSV = () => {
    if (!result || !params) return;
    const csv = generateCSV(result, params.durationDays);
    downloadCSV(csv, `harmonogram-${params.durationDays}dni.csv`);
  };

  const effectivePeopleCount = params?.peopleCount ?? defaultValues.peopleCount ?? currentPeopleCount;

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

        <ScheduleForm
          onSubmit={handleSubmit}
          defaultValues={defaultValues}
          onPeopleCountChange={handlePeopleCountChange}
        />

        <PersonCreator
          peopleCount={effectivePeopleCount}
          persons={persons}
          nightStartHour={nightStartHour}
          nightEndHour={nightEndHour}
          onChange={handlePersonsChange}
        />

        <ConstraintsEditor
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
