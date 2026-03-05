'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScheduleConstraint } from '@/types/schedule';

interface ConstraintsEditorProps {
  constraints: ScheduleConstraint[];
  onChange: (constraints: ScheduleConstraint[]) => void;
}

export function ConstraintsEditor({ constraints, onChange }: ConstraintsEditorProps) {
  const [nightMax, setNightMax] = useState(1);
  const [nightStart, setNightStart] = useState(22);
  const [nightEnd, setNightEnd] = useState(6);

  const nightConstraint = constraints.find((c) => c.type === 'nightShiftLimit');

  const addNightLimit = () => {
    const filtered = constraints.filter((c) => c.type !== 'nightShiftLimit');
    onChange([
      ...filtered,
      { type: 'nightShiftLimit', maxPeople: nightMax, nightStartHour: nightStart, nightEndHour: nightEnd },
    ]);
  };

  const removeNightLimit = () => {
    onChange(constraints.filter((c) => c.type !== 'nightShiftLimit'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ograniczenia globalne</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Limit osób na nocnej zmianie</h4>
          {nightConstraint && nightConstraint.type === 'nightShiftLimit' ? (
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
      </CardContent>
    </Card>
  );
}
