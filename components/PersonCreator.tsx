'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PersonConfig } from '@/types/schedule';

interface PersonCreatorProps {
  peopleCount: number;
  persons: PersonConfig[];
  nightStartHour: number;
  nightEndHour: number;
  onChange: (persons: PersonConfig[]) => void;
}

export function PersonCreator({ peopleCount, persons, nightStartHour, nightEndHour, onChange }: PersonCreatorProps) {
  // Upewnij się że lista ma odpowiednią długość
  const effectivePersons: PersonConfig[] = Array.from({ length: peopleCount }, (_, i) =>
    persons[i] ?? { name: '', blockedHours: null, canWorkAtNight: true }
  );

  const updatePerson = useCallback((index: number, patch: Partial<PersonConfig>) => {
    const updated = effectivePersons.map((p, i) =>
      i === index ? { ...p, ...patch } : p
    );
    onChange(updated);
  }, [effectivePersons, onChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kreator osób</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {effectivePersons.map((person, i) => (
            <div
              key={i}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <Input
                  type="text"
                  placeholder={`Osoba ${i + 1}`}
                  value={person.name}
                  onChange={(e) => updatePerson(i, { name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              {/* Praca w nocy */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={person.canWorkAtNight}
                  onChange={(e) => updatePerson(i, { canWorkAtNight: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">
                  Może pracować w nocy
                  <span className="text-muted-foreground text-xs ml-1">
                    ({nightStartHour}:00–{nightEndHour}:00)
                  </span>
                </span>
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
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={person.blockedHours.startHour}
                        onChange={(e) =>
                          updatePerson(i, {
                            blockedHours: {
                              ...person.blockedHours!,
                              startHour: Number(e.target.value),
                            },
                          })
                        }
                        className="w-16 h-8 text-sm"
                      />
                    </div>
                    <span className="text-muted-foreground mt-4">–</span>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-muted-foreground">Do</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={person.blockedHours.endHour}
                        onChange={(e) =>
                          updatePerson(i, {
                            blockedHours: {
                              ...person.blockedHours!,
                              endHour: Number(e.target.value),
                            },
                          })
                        }
                        className="w-16 h-8 text-sm"
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
