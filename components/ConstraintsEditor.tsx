'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScheduleConstraint } from '@/types/schedule';

interface ConstraintsEditorProps {
  peopleCount: number;
  personNames: string[];
  constraints: ScheduleConstraint[];
  onChange: (constraints: ScheduleConstraint[]) => void;
}

export function ConstraintsEditor({ peopleCount, personNames, constraints, onChange }: ConstraintsEditorProps) {
  // Stan formularzy dodawania
  const [nightMax, setNightMax] = useState(1);
  const [nightStart, setNightStart] = useState(22);
  const [nightEnd, setNightEnd] = useState(6);

  const [blockedPerson, setBlockedPerson] = useState(0);
  const [blockedStart, setBlockedStart] = useState(22);
  const [blockedEnd, setBlockedEnd] = useState(6);

  const nightConstraint = constraints.find((c) => c.type === 'nightShiftLimit');
  const personBlocked = constraints.filter((c) => c.type === 'personBlocked');

  const addNightLimit = () => {
    // Usuń stary limit nocny i dodaj nowy
    const filtered = constraints.filter((c) => c.type !== 'nightShiftLimit');
    onChange([
      ...filtered,
      { type: 'nightShiftLimit', maxPeople: nightMax, nightStartHour: nightStart, nightEndHour: nightEnd },
    ]);
  };

  const removeNightLimit = () => {
    onChange(constraints.filter((c) => c.type !== 'nightShiftLimit'));
  };

  const addPersonBlocked = () => {
    onChange([
      ...constraints,
      { type: 'personBlocked', personId: blockedPerson, startHour: blockedStart, endHour: blockedEnd },
    ]);
  };

  const removeConstraint = (index: number) => {
    const newConstraints = [...constraints];
    newConstraints.splice(index, 1);
    onChange(newConstraints);
  };

  const names = Array.from({ length: peopleCount }, (_, i) => personNames[i] || `Osoba ${i + 1}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ograniczenia (opcjonalne)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Limit nocny */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Limit osób na nocnej zmianie</h4>
          {nightConstraint ? (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <span className="text-sm flex-1">
                Maks. <strong>{nightConstraint.maxPeople}</strong> {nightConstraint.maxPeople === 1 ? 'osoba' : 'osób'} w nocy ({nightConstraint.nightStartHour}:00–{nightConstraint.nightEndHour}:00)
              </span>
              <Button variant="outline" size="sm" onClick={removeNightLimit}>
                Usuń
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Maks. osób</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={nightMax}
                  onChange={(e) => setNightMax(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <div>
                <Label className="text-xs">Noc od</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={nightStart}
                  onChange={(e) => setNightStart(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <div>
                <Label className="text-xs">Noc do</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={nightEnd}
                  onChange={(e) => setNightEnd(Number(e.target.value))}
                  className="w-20"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={addNightLimit}>
                Dodaj limit nocny
              </Button>
            </div>
          )}
        </div>

        {/* Blokada osoby */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Zablokowane godziny dla osoby</h4>

          {/* Lista istniejących blokad */}
          {personBlocked.map((c, idx) => {
            if (c.type !== 'personBlocked') return null;
            const globalIdx = constraints.indexOf(c);
            return (
              <div key={idx} className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <span className="text-sm flex-1">
                  <strong>{names[c.personId]}</strong> nie pracuje w godzinach {c.startHour}:00–{c.endHour}:00
                </span>
                <Button variant="outline" size="sm" onClick={() => removeConstraint(globalIdx)}>
                  Usuń
                </Button>
              </div>
            );
          })}

          {/* Formularz dodawania */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Osoba</Label>
              <select
                value={blockedPerson}
                onChange={(e) => setBlockedPerson(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {names.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Od godziny</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={blockedStart}
                onChange={(e) => setBlockedStart(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <div>
              <Label className="text-xs">Do godziny</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={blockedEnd}
                onChange={(e) => setBlockedEnd(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={addPersonBlocked}>
              Dodaj blokadę
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
