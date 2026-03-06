'use client';

import { useState, useCallback } from 'react';
import { UserPlus, Pencil, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PersonForm } from '@/components/people/PersonForm';
import type { Person } from '@/types/person';

const PEOPLE_KEY = 'app-people';
const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

function getStored(): Person[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PEOPLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>(getStored);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [search, setSearch] = useState('');

  const save = useCallback((list: Person[]) => {
    setPeople(list);
    try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const handleSave = (person: Person) => {
    if (editing) {
      save(people.map((p) => (p.id === person.id ? person : p)));
    } else {
      save([...people, person]);
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    save(people.filter((p) => p.id !== id));
  };

  const filtered = people.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Osoby</h1>
          <p className="mt-1 text-muted-foreground">
            Zarządzaj pracownikami. Te osoby będą dostępne w kreatorze grafiku.
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4" />
          Dodaj osobę
        </Button>
      </div>

      <PersonForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSave={handleSave}
        initial={editing}
      />

      <div className="max-w-4xl space-y-4">
        {people.length > 0 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po nazwisku lub roli..."
            className="max-w-sm bg-background"
          />
        )}

        {people.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="font-medium">Brak osób</p>
                <p className="text-sm text-muted-foreground">
                  Dodaj pierwszego pracownika, aby móc tworzyć grafiki.
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-2 gap-1.5"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Dodaj osobę
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((person) => (
              <Card key={person.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {person.role && (
                          <Badge variant="secondary">{person.role}</Badge>
                        )}
                        <span>{person.weeklyHours}h/tyg</span>
                        {person.unavailableDays.length > 0 && (
                          <span className="text-destructive">
                            wolne: {person.unavailableDays.map((d) => DAYS[d]).join(', ')}
                          </span>
                        )}
                        {person.notes && (
                          <span>&middot; {person.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(person);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(person.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filtered.length === 0 && search && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Brak wyników dla &quot;{search}&quot;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
