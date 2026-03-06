'use client';

import { useState, useCallback } from 'react';
import { StepIndicator } from '@/components/schedule/StepIndicator';
import { PeriodStep, type PeriodStepData } from '@/components/schedule/PeriodStep';
import { PeopleStep } from '@/components/schedule/PeopleStep';
import { ResultStep } from '@/components/schedule/ResultStep';
import { generatePlanSchedule } from '@/lib/plan-scheduler';
import type { Person } from '@/types/person';
import type { ScheduleTemplate, PlanResult, WorkingHoursConfig, StaffConstraints } from '@/types/schedule-plan';

const TEMPLATES_KEY = 'schedule-templates';
const PEOPLE_KEY = 'app-people';

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

const STEPS = [
  { label: 'Okres i zmiany', description: 'Konfiguracja grafiku' },
  { label: 'Osoby', description: 'Przypisz pracowników' },
  { label: 'Grafik', description: 'Wynik generowania' },
];

export default function SchedulePage() {
  const [step, setStep] = useState(0);

  // Templates
  const [templates, setTemplates] = useState<ScheduleTemplate[]>(
    () => getStored(TEMPLATES_KEY, [])
  );

  const saveTemplates = useCallback((ts: ScheduleTemplate[]) => {
    setTemplates(ts);
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(ts)); } catch {}
  }, []);

  // People (from the shared /people store)
  const people: Person[] = getStored(PEOPLE_KEY, []);

  // Wizard state
  const [periodData, setPeriodData] = useState<PeriodStepData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [constraints, setConstraints] = useState<StaffConstraints | null>(null);

  // Step 1 → 2
  const handlePeriodNext = (data: PeriodStepData) => {
    setPeriodData(data);
    setWorkingHours(data.workingHours);
    setConstraints(data.constraints);
    setStep(1);
  };

  // Step 2 → 3
  const handlePeopleNext = () => {
    if (!periodData) return;
    const selected = people.filter((p) => selectedIds.includes(p.id));
    const res = generatePlanSchedule(
      selected,
      periodData.period,
      periodData.workingHours,
      periodData.constraints,
    );
    setResult(res);
    setStep(2);
  };

  const handleReset = () => {
    setStep(0);
    setPeriodData(null);
    setSelectedIds([]);
    setResult(null);
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Nowy grafik</h1>
        <p className="mt-1 text-muted-foreground">
          Kreator harmonogramu w 3 krokach
        </p>
      </div>

      <div className="max-w-5xl">
        <StepIndicator steps={STEPS} current={step} />

        {step === 0 && (
          <PeriodStep
            templates={templates}
            onSaveTemplate={(t) => saveTemplates([...templates, t])}
            onDeleteTemplate={(id) => saveTemplates(templates.filter((t) => t.id !== id))}
            onNext={handlePeriodNext}
          />
        )}

        {step === 1 && (
          <PeopleStep
            people={people}
            selectedIds={selectedIds}
            onChangeSelection={setSelectedIds}
            onBack={() => setStep(0)}
            onNext={handlePeopleNext}
          />
        )}

        {step === 2 && result && workingHours && constraints && (
          <ResultStep
            result={result}
            workingHours={workingHours}
            constraints={constraints}
            onBack={() => setStep(1)}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
