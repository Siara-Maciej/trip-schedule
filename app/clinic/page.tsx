'use client';

import { useState, useCallback, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeList } from '@/components/clinic/EmployeeList';
import { EmployeeForm } from '@/components/clinic/EmployeeForm';
import { ClinicSettings } from '@/components/clinic/ClinicSettings';
import { ClinicScheduleView } from '@/components/clinic/ClinicScheduleView';
import { generateClinicSchedule } from '@/lib/clinic-scheduler';
import type { ClinicEmployee, ClinicConfig, ClinicScheduleResult } from '@/types/clinic';

const EMPLOYEES_KEY = 'clinic-employees';
const CONFIG_KEY = 'clinic-config';

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

const DEFAULT_CONFIG: ClinicConfig = {
  openTime: '08:00',
  closeTime: '20:00',
  workDays: [0, 1, 2, 3, 4], // Mon-Fri
  minStaffPerShift: 2,
  weekStartDate: getMonday(),
};

function getStoredEmployees(): ClinicEmployee[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(EMPLOYEES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function getStoredConfig(): ClinicConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

export default function ClinicPage() {
  const [employees, setEmployees] = useState<ClinicEmployee[]>(getStoredEmployees);
  const [config, setConfig] = useState<ClinicConfig>(getStoredConfig);
  const [result, setResult] = useState<ClinicScheduleResult | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<ClinicEmployee | null>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const saveEmployees = useCallback((emps: ClinicEmployee[]) => {
    setEmployees(emps);
    try { localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(emps)); } catch {}
  }, []);

  const saveConfig = useCallback((cfg: ClinicConfig) => {
    setConfig(cfg);
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch {}
  }, []);

  const handleAddEmployee = (emp: ClinicEmployee) => {
    if (editingEmployee) {
      saveEmployees(employees.map((e) => (e.id === emp.id ? emp : e)));
    } else {
      saveEmployees([...employees, emp]);
    }
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (id: string) => {
    saveEmployees(employees.filter((e) => e.id !== id));
  };

  const handleGenerate = () => {
    if (employees.length === 0) return;
    setLoading(true);
    // Use setTimeout to allow UI to show loading state
    setTimeout(() => {
      const scheduleResult = generateClinicSchedule(employees, config);
      setResult(scheduleResult);
      setLoading(false);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 50);
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Grafik przychodni</h1>
        <p className="mt-1 text-muted-foreground">
          Generuj tygodniowy grafik pracowników przychodni
        </p>
      </div>

      <div className="max-w-5xl space-y-6">
        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees">Pracownicy</TabsTrigger>
            <TabsTrigger value="settings">Ustawienia</TabsTrigger>
          </TabsList>

          <TabsContent value="employees">
            <EmployeeList
              employees={employees}
              onAdd={() => {
                setEditingEmployee(null);
                setFormOpen(true);
              }}
              onEdit={(emp) => {
                setEditingEmployee(emp);
                setFormOpen(true);
              }}
              onDelete={handleDeleteEmployee}
            />
          </TabsContent>

          <TabsContent value="settings">
            <ClinicSettings config={config} onChange={saveConfig} />
          </TabsContent>
        </Tabs>

        <EmployeeForm
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingEmployee(null);
          }}
          onSave={handleAddEmployee}
          initial={editingEmployee}
        />

        <Button
          size="lg"
          className="w-full gap-2 sm:w-auto"
          onClick={handleGenerate}
          disabled={employees.length === 0 || loading}
        >
          <CalendarDays className="h-4 w-4" />
          {loading ? 'Generowanie...' : 'Generuj grafik'}
        </Button>

        {result && (
          <div ref={resultRef}>
            <ClinicScheduleView result={result} config={config} />
          </div>
        )}
      </div>
    </div>
  );
}
