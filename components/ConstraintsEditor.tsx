'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeInput, hourToTime, timeToHour } from '@/components/ui/time-input';

export interface NightWorkConfig {
  enabled: boolean;
  nightStartHour: number;
  nightEndHour: number;
  maxNightPeople: number;
}

interface ConstraintsEditorProps {
  nightWork: NightWorkConfig;
  onChange: (config: NightWorkConfig) => void;
}

export function ConstraintsEditor({ nightWork, onChange }: ConstraintsEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ograniczenia globalne</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={nightWork.enabled}
              onChange={(e) => onChange({ ...nightWork, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-primary"
            />
            <span className="text-sm font-medium">Wymagana praca w nocy</span>
          </label>

          {nightWork.enabled && (
            <div className="space-y-3 pl-6">
              <div className="flex items-center gap-3">
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Noc od</Label>
                  <TimeInput
                    value={hourToTime(nightWork.nightStartHour)}
                    onChange={(v) => onChange({ ...nightWork, nightStartHour: timeToHour(v) })}
                  />
                </div>
                <span className="text-muted-foreground mt-4">–</span>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Noc do</Label>
                  <TimeInput
                    value={hourToTime(nightWork.nightEndHour)}
                    onChange={(v) => onChange({ ...nightWork, nightEndHour: timeToHour(v) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Maks. osób w nocy</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={nightWork.maxNightPeople}
                  onChange={(e) => onChange({ ...nightWork, maxNightPeople: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-16 h-9"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
