'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Native time input styled consistently across the app.
 * Uses <input type="time"> for native browser time picker.
 */
export function TimeInput({ value, onChange, className, disabled }: TimeInputProps) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'bg-background w-[120px] appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
        className,
      )}
    />
  );
}

/** Parse "HH:MM" → hour number (0-23). Minutes are truncated. */
export function timeToHour(time: string): number {
  const [hh] = time.split(':').map(Number);
  return Math.min(23, Math.max(0, hh || 0));
}

/** Convert hour number → "HH:00" string */
export function hourToTime(hour: number): string {
  return String(Math.min(23, Math.max(0, hour))).padStart(2, '0') + ':00';
}

/**
 * DurationInput — masked input for durations in hours (1-24).
 * Displays and stores as integer hours.
 */
interface DurationInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
}

export function DurationInput({ value, onChange, min = 1, max = 24, className, disabled }: DurationInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d]/g, '');
      if (raw === '') {
        onChange(min);
        return;
      }
      let num = parseInt(raw, 10);
      if (num > max) num = max;
      onChange(num);
    },
    [onChange, min, max],
  );

  const handleBlur = useCallback(() => {
    if (value < min) onChange(min);
    if (value > max) onChange(max);
  }, [value, onChange, min, max]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        maxLength={2}
        className={cn(
          'flex h-9 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 text-center font-mono',
          className,
        )}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h</span>
    </div>
  );
}
