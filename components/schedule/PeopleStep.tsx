'use client';

import { useState } from 'react';
import { Check, UserPlus, ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Person } from '@/types/person';

interface PeopleStepProps {
  people: Person[];
  selectedIds: string[];
  onChangeSelection: (ids: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function PeopleStep({
  people,
  selectedIds,
  onChangeSelection,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wybierz osoby</CardTitle>
          <CardDescription>
            Zaznacz pracowników, którzy mają być uwzględnieni w grafiku.
            Wybrano: {selectedIds.length} z {people.length}
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
                  return (
                    <button
                      key={person.id}
                      onClick={() => toggle(person.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/50'
                      )}
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
                          <span className="text-xs text-muted-foreground">
                            {person.weeklyHours}h/tyg
                          </span>
                        </div>
                      </div>
                    </button>
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
