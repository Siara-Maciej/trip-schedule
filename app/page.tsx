'use client';

import { useState, useCallback, Suspense } from 'react';
import { ScheduleForm, type DateRangeData } from '@/components/ScheduleForm';
import { ScheduleTable } from '@/components/ScheduleTable';
import { TimelineView } from '@/components/TimelineView';
import { StatsCards } from '@/components/StatsCards';
import { CoverageAlert } from '@/components/CoverageAlert';
import { ConstraintsEditor } from '@/components/ConstraintsEditor';
import { PersonCreator } from '@/components/PersonCreator';
import { Button } from '@/components/ui/button';
import { generateSchedule } from '@/lib/scheduler';
import { generateCSV, downloadCSV } from '@/lib/csv-export';
import { downloadPDF } from '@/lib/pdf-export';
import type { ScheduleResult, ScheduleConstraint, PersonConfig } from '@/types/schedule';

const PERSONS_KEY = 'schedule-persons';
const NIGHT_KEY = 'schedule-night';

interface NightWorkConfig {
  enabled: boolean;
  nightStartHour: number;
  nightEndHour: number;
}

function getStoredPersons(): PersonConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PERSONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignoruj */ }
  return [];
}

function getStoredNight(): NightWorkConfig {
  if (typeof window === 'undefined') return { enabled: false, nightStartHour: 22, nightEndHour: 6 };
  try {
    const stored = localStorage.getItem(NIGHT_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignoruj */ }
  return { enabled: false, nightStartHour: 22, nightEndHour: 6 };
}

function buildConstraints(
  persons: PersonConfig[],
  nightWork: NightWorkConfig,
): ScheduleConstraint[] {
  const constraints: ScheduleConstraint[] = [];

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
  }

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
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [durationDays, setDurationDays] = useState(0);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const [persons, setPersons] = useState<PersonConfig[]>(getStoredPersons);
  const [nightWork, setNightWork] = useState<NightWorkConfig>(getStoredNight);

  const handlePersonsChange = useCallback((newPersons: PersonConfig[]) => {
    setPersons(newPersons);
    try { localStorage.setItem(PERSONS_KEY, JSON.stringify(newPersons)); } catch { /* ignoruj */ }
  }, []);

  const handleNightChange = useCallback((config: NightWorkConfig) => {
    setNightWork(config);
    try { localStorage.setItem(NIGHT_KEY, JSON.stringify(config)); } catch { /* ignoruj */ }
  }, []);

  const handleSubmit = useCallback((data: DateRangeData) => {
    if (persons.length < 2) return;

    const diffMs = data.endDate.getTime() - data.startDate.getTime();
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const startHourOffset = data.startDate.getHours();
    const daysCount = Math.ceil((startHourOffset + totalHours) / 24);

    const names = persons.map((p, i) => p.name.trim() || `Osoba ${i + 1}`);
    const constraints = buildConstraints(persons, nightWork);

    const scheduleResult = generateSchedule({
      peopleCount: persons.length,
      totalHours,
      startHourOffset,
      names,
      perPersonShiftHours: persons.map((p) => p.hoursPerShift),
      perPersonMinBreak: persons.map((p) => p.minBreakHours),
      constraints,
    });

    setResult(scheduleResult);
    setDurationDays(daysCount);
    setDateRange({
      start: data.startDate.toLocaleString('pl-PL'),
      end: data.endDate.toLocaleString('pl-PL'),
    });
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
  }, [persons, nightWork]);

  const handleExportCSV = () => {
    if (!result) return;
    const csv = generateCSV(result, durationDays);
    downloadCSV(csv, `harmonogram-${durationDays}dni.csv`);
  };

  const handleExportPDF = () => {
    if (!result) return;
    downloadPDF(
      {
        result,
        durationDays,
        persons,
        startDate: dateRange?.start,
        endDate: dateRange?.end,
      },
      `harmonogram-${durationDays}dni.pdf`,
    );
  };

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

        <ScheduleForm onSubmit={handleSubmit} />

        <PersonCreator persons={persons} onChange={handlePersonsChange} />

        <ConstraintsEditor nightWork={nightWork} onChange={handleNightChange} />

        {result && (
          <div
            className={`space-y-6 transition-opacity duration-500 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <CoverageAlert result={result} />

            <StatsCards
              result={result}
              durationDays={durationDays}
              hoursPerShift={avgShift}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                Pobierz CSV
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                Pobierz PDF
              </Button>
            </div>

            <ScheduleTable
              result={result}
              durationDays={durationDays}
              hoursPerShift={avgShift}
            />

            <TimelineView
              result={result}
              durationDays={durationDays}
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
