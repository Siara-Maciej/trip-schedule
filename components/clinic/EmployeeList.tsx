'use client';

import { UserPlus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CLINIC_ROLES, SHIFT_PREFERENCES, type ClinicEmployee } from '@/types/clinic';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

const ROLE_COLORS: Record<string, string> = {
  lekarz: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  pielegniarka: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  rejestratorka: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  technik: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  inny: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
};

interface EmployeeListProps {
  employees: ClinicEmployee[];
  onAdd: () => void;
  onEdit: (emp: ClinicEmployee) => void;
  onDelete: (id: string) => void;
}

export function EmployeeList({ employees, onAdd, onEdit, onDelete }: EmployeeListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Pracownicy</CardTitle>
          <CardDescription>{employees.length} osób</CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onAdd}>
          <UserPlus className="h-4 w-4" />
          Dodaj
        </Button>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Brak pracowników. Dodaj pierwszą osobę.
          </p>
        ) : (
          <div className="space-y-3">
            {employees.map((emp) => {
              const roleLabel = CLINIC_ROLES.find((r) => r.value === emp.role)?.label ?? emp.role;
              const prefLabel = SHIFT_PREFERENCES.find((s) => s.value === emp.shiftPreferences[0])?.label ?? '';
              return (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className={ROLE_COLORS[emp.role] ?? ''}>
                          {roleLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {emp.weeklyHours}h/tyg
                        </span>
                        <span className="text-xs text-muted-foreground">
                          &middot; {prefLabel}
                        </span>
                        {emp.unavailableDays.length > 0 && (
                          <span className="text-xs text-destructive">
                            &middot; wolne: {emp.unavailableDays.map((d) => DAYS[d]).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(emp)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(emp.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
