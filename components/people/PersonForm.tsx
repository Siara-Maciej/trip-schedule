'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Person } from '@/types/person';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

interface PersonFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (person: Person) => void;
  initial?: Person | null;
}

export function PersonForm({ open, onOpenChange, onSave, initial }: PersonFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [weeklyHours, setWeeklyHours] = useState(initial?.weeklyHours ?? 40);
  const [unavailableDays, setUnavailableDays] = useState<number[]>(
    initial?.unavailableDays ?? []
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

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
      role: role.trim(),
      weeklyHours,
      unavailableDays,
      notes: notes.trim(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edytuj osobę' : 'Dodaj osobę'}</DialogTitle>
          <DialogDescription>Dane pracownika</DialogDescription>
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
              <Label>Rola / stanowisko</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="np. Lekarz"
              />
            </div>
            <div className="space-y-2">
              <Label>Godziny / tydzień</Label>
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
            <p className="text-xs text-muted-foreground">Kliknij dzień = niedostępny</p>
          </div>

          <div className="space-y-2">
            <Label>Notatki</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcjonalne uwagi..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initial ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
