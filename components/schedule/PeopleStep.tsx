'use client';

import { useState } from 'react';
import { Check, UserPlus, ArrowLeft, ChevronRight, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Person } from '@/types/person';
import type { HourOverrides } from '@/types/schedule-plan';

interface PeopleStepProps {
  people: Person[];
  selectedIds: string[];
  defaultHours: number;
  hourOverrides: HourOverrides;
  onChangeSelection: (ids: string[]) => void;
  onChangeHourOverrides: (overrides: HourOverrides) => void;
  onBack: () => void;
  onNext: () => void;
}

export function PeopleStep({
  people,
  selectedIds,
  defaultHours,
  hourOverrides,
  onChangeSelection,
  onChangeHourOverrides,
  onBack,
  onNext,
}: PeopleStepProps) {
  const [search, setSearch] = useState('');

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChangeSelection(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id]
    );
  };

  const selectAll = () => {
    onChangeSelection(filtered.map((p) => p.id));
  };

  const deselectAll = () => {
    onChangeSelection([]);
  };

  const getHours = (personId: string): number => {
    return hourOverrides[personId] ?? defaultHours;
  };

  const setPersonHours = (personId: string, hours: number) => {
    if (hours === defaultHours) {
      // Remove override — use default
      const next = { ...hourOverrides };
      delete next[personId];
      onChangeHourOverrides(next);
    } else {
      onChangeHourOverrides({ ...hourOverrides, [personId]: hours });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wybierz osoby</CardTitle>
          <CardDescription>
            Zaznacz pracowników i ustaw ich budżet godzinowy.
            Domyślnie: {defaultHours}h na okres. Wybrano: {selectedIds.length} z {people.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {people.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <UserPlus className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">Brak osób w systemie</p>
                <p className="text-xs text-muted-foreground">
                  Dodaj osoby w zakładce &quot;Osoby&quot; przed tworzeniem grafiku.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Szukaj..."
                    className="bg-background pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Zaznacz wszystkich
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Odznacz
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {filtered.map((person) => {
                  const selected = selectedIds.includes(person.id);
                  const hours = getHours(person.id);
                  const isOverridden = person.id in hourOverrides;

                  return (
                    <div
                      key={person.id}
                      className={cn(
                        'rounded-lg border transition-all',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      {/* Selection row */}
                      <button
                        onClick={() => toggle(person.id)}
                        className="flex w-full items-center gap-3 p-3 text-left"
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            person.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{person.name}</p>
                          <div className="flex items-center gap-1.5">
                            {person.role && (
                              <Badge variant="secondary" className="text-xs">
                                {person.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Hours override row — only when selected */}
                      {selected && (
                        <div className="flex items-center gap-2 border-t px-3 py-2">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            value={hours}
                            onChange={(e) => setPersonHours(person.id, Number(e.target.value))}
                            className="h-7 w-16 bg-background text-xs"
                          />
                          <span className="text-xs text-muted-foreground">h</span>
                          {isOverridden && (
                            <Badge
                              variant="outline"
                              className="cursor-pointer text-[10px] hover:bg-destructive/10"
                              onClick={() => setPersonHours(person.id, defaultHours)}
                            >
                              reset
                            </Badge>
                          )}
                          {!isOverridden && (
                            <span className="text-[10px] text-muted-foreground">(domyślnie)</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Wróć
        </Button>
        <Button
          size="lg"
          onClick={onNext}
          disabled={selectedIds.length === 0}
        >
          Generuj grafik
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
