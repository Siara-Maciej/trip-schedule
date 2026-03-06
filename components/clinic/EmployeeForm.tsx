'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  CLINIC_ROLES,
  SHIFT_PREFERENCES,
  type ClinicEmployee,
  type ClinicRole,
  type ShiftPreference,
} from '@/types/clinic';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (employee: ClinicEmployee) => void;
  initial?: ClinicEmployee | null;
}

export function EmployeeForm({ open, onOpenChange, onSave, initial }: EmployeeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState<ClinicRole>(initial?.role ?? 'lekarz');
  const [weeklyHours, setWeeklyHours] = useState(initial?.weeklyHours ?? 40);
  const [shiftPref, setShiftPref] = useState<ShiftPreference>(
    initial?.shiftPreferences[0] ?? 'caly_dzien'
  );
  const [unavailableDays, setUnavailableDays] = useState<number[]>(
    initial?.unavailableDays ?? []
  );

  const toggleDay = (day: number) => {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      role,
      weeklyHours,
      shiftPreferences: [shiftPref],
      unavailableDays,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edytuj pracownika' : 'Dodaj pracownika'}</DialogTitle>
          <DialogDescription>
            Wypełnij dane pracownika przychodni
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Imię i nazwisko</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jan Kowalski"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rola</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ClinicRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Godz. tygodniowo</Label>
              <Input
                type="number"
                min={4}
                max={60}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferowana zmiana</Label>
            <Select value={shiftPref} onValueChange={(v) => setShiftPref(v as ShiftPreference)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_PREFERENCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dni niedostępności</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <Badge
                  key={d}
                  variant={unavailableDays.includes(i) ? 'destructive' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleDay(i)}
                >
                  {d}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Kliknij dzień, aby oznaczyć jako niedostępny
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initial ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
