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
              className="h-5 w-5 shrink-0 appearance-none rounded border-2 border-muted-foreground/40 bg-background checked:border-primary checked:bg-primary cursor-pointer checked:bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%224%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpolyline%20points=%2220%206%209%2017%204%2012%22/%3E%3C/svg%3E')] checked:bg-center checked:bg-no-repeat checked:bg-[length:14px_14px]"
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
