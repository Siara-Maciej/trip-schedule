'use client';

import { useState, useCallback } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface DateRangeData {
  startDate: Date;
  startTime: string; // "HH:MM"
  endDate: Date;
  endTime: string;   // "HH:MM"
}

interface ScheduleFormProps {
  onSubmit: (data: DateRangeData) => void;
  defaultValues?: Partial<DateRangeData>;
  loading?: boolean;
}

export function ScheduleForm({ onSubmit, defaultValues, loading }: ScheduleFormProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(defaultValues?.startDate);
  const [startTime, setStartTime] = useState(defaultValues?.startTime ?? '08:00');
  const [endDate, setEndDate] = useState<Date | undefined>(defaultValues?.endDate);
  const [endTime, setEndTime] = useState(defaultValues?.endTime ?? '08:00');
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!startDate || !endDate) {
        setError('Wybierz datę rozpoczęcia i zakończenia.');
        return;
      }

      const start = new Date(startDate);
      const [sh, sm] = startTime.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);

      const end = new Date(endDate);
      const [eh, em] = endTime.split(':').map(Number);
      end.setHours(eh, em, 0, 0);

      if (end <= start) {
        setError('Data zakończenia musi być późniejsza niż data rozpoczęcia.');
        return;
      }

      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 24) {
        setError('Harmonogram musi obejmować co najmniej 24 godziny.');
        return;
      }

      setError(null);
      onSubmit({ startDate: start, startTime, endDate: end, endTime });
    },
    [startDate, startTime, endDate, endTime, onSubmit],
  );

  const formatDate = (date: Date | undefined) =>
    date ? date.toLocaleDateString('pl-PL') : 'Wybierz datę';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Parametry harmonogramu</CardTitle>
        <CardDescription>Ustaw okres trwania wycieczki</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Start */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Rozpoczęcie</h4>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground px-1">Data</Label>
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-between font-normal w-[160px]">
                        {formatDate(startDate)}
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground px-1">Godzina</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-background w-[120px] appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* End */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Zakończenie</h4>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground px-1">Data</Label>
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-between font-normal w-[160px]">
                        {formatDate(endDate)}
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground px-1">Godzina</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-background w-[120px] appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" className="w-full sm:w-auto" size="lg" disabled={loading}>
              Generuj harmonogram
            </Button>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generowanie...
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
