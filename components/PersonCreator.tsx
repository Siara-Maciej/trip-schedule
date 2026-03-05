'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeInput, DurationInput, hourToTime, timeToHour } from '@/components/ui/time-input';
import type { PersonConfig } from '@/types/schedule';

interface PersonCreatorProps {
  persons: PersonConfig[];
  onChange: (persons: PersonConfig[]) => void;
}

const DEFAULT_PERSON: PersonConfig = {
  name: '',
  hoursPerShift: 8,
  minBreakHours: 11,
  blockedHours: null,
  canWorkAtNight: true,
};

export function PersonCreator({ persons, onChange }: PersonCreatorProps) {
  const addPerson = useCallback(() => {
    onChange([...persons, { ...DEFAULT_PERSON }]);
  }, [persons, onChange]);

  const removePerson = useCallback(
    (index: number) => {
      if (persons.length <= 2) return;
      onChange(persons.filter((_, i) => i !== index));
    },
    [persons, onChange],
  );

  const updatePerson = useCallback(
    (index: number, patch: Partial<PersonConfig>) => {
      onChange(persons.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    },
    [persons, onChange],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Kreator osób</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{persons.length} osób</p>
        </div>
        <Button variant="default" size="sm" onClick={addPerson}>
          + Dodaj osobę
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {persons.map((person, i) => (
            <div
              key={i}
              className="rounded-lg border border-border p-4 space-y-3 relative"
            >
              {/* Header: numer + imię + usuń */}
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <Input
                  type="text"
                  placeholder={`Osoba ${i + 1}`}
                  value={person.name}
                  onChange={(e) => updatePerson(i, { name: e.target.value })}
                  className="h-8 text-sm flex-1"
                />
                {persons.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removePerson(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1"
                    title="Usuń osobę"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Długość zmiany */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Zmiana</Label>
                <DurationInput
                  value={person.hoursPerShift}
                  onChange={(v) => updatePerson(i, { hoursPerShift: v })}
                  min={4}
                  max={12}
                />
              </div>

              {/* Min. przerwa */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Min. przerwa</Label>
                <DurationInput
                  value={person.minBreakHours}
                  onChange={(v) => updatePerson(i, { minBreakHours: v })}
                  min={4}
                  max={24}
                />
              </div>

              {/* Może pracować w nocy */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={person.canWorkAtNight}
                  onChange={(e) => updatePerson(i, { canWorkAtNight: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">Może pracować w nocy</span>
              </label>

              {/* Blokada godzin */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={person.blockedHours !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updatePerson(i, { blockedHours: { startHour: 0, endHour: 8 } });
                      } else {
                        updatePerson(i, { blockedHours: null });
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                  />
                  <span className="text-sm">Blokada godzin</span>
                </label>

                {person.blockedHours !== null && (
                  <div className="flex items-center gap-2 pl-6">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Od</Label>
                      <TimeInput
                        value={hourToTime(person.blockedHours.startHour)}
                        onChange={(v) =>
                          updatePerson(i, {
                            blockedHours: {
                              ...person.blockedHours!,
                              startHour: timeToHour(v),
                            },
                          })
                        }
                      />
                    </div>
                    <span className="text-muted-foreground mt-4">–</span>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Do</Label>
                      <TimeInput
                        value={hourToTime(person.blockedHours.endHour)}
                        onChange={(v) =>
                          updatePerson(i, {
                            blockedHours: {
                              ...person.blockedHours!,
                              endHour: timeToHour(v),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
