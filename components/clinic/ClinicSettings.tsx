'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClinicConfig } from '@/types/clinic';

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

interface ClinicSettingsProps {
  config: ClinicConfig;
  onChange: (config: ClinicConfig) => void;
}

export function ClinicSettings({ config, onChange }: ClinicSettingsProps) {
  const toggleDay = (day: number) => {
    const next = config.workDays.includes(day)
      ? config.workDays.filter((d) => d !== day)
      : [...config.workDays, day];
    onChange({ ...config, workDays: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ustawienia przychodni</CardTitle>
        <CardDescription>Godziny otwarcia i dni pracy</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Otwarcie</Label>
            <Input
              type="time"
              value={config.openTime}
              onChange={(e) => onChange({ ...config, openTime: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Zamknięcie</Label>
            <Input
              type="time"
              value={config.closeTime}
              onChange={(e) => onChange({ ...config, closeTime: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Min. personelu</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={config.minStaffPerShift}
              onChange={(e) =>
                onChange({ ...config, minStaffPerShift: Number(e.target.value) })
              }
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tydzień od</Label>
            <Input
              type="date"
              value={config.weekStartDate}
              onChange={(e) =>
                onChange({ ...config, weekStartDate: e.target.value })
              }
              className="bg-background"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Dni pracy</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <Badge
                key={d}
                variant={config.workDays.includes(i) ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => toggleDay(i)}
              >
                {d}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
