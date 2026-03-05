'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Masked time input (HH:MM). Stores value as "HH:MM" string.
 */
export function TimeInput({ value, onChange, className, disabled }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^\d]/g, '');

      // Limit to 4 digits
      if (raw.length > 4) raw = raw.slice(0, 4);

      // Clamp hours
      if (raw.length >= 2) {
        let hh = parseInt(raw.slice(0, 2), 10);
        if (hh > 23) hh = 23;
        raw = String(hh).padStart(2, '0') + raw.slice(2);
      }

      // Clamp minutes
      if (raw.length >= 4) {
        let mm = parseInt(raw.slice(2, 4), 10);
        if (mm > 59) mm = 59;
        raw = raw.slice(0, 2) + String(mm).padStart(2, '0');
      }

      // Format with colon
      let formatted = raw;
      if (raw.length >= 3) {
        formatted = raw.slice(0, 2) + ':' + raw.slice(2);
      }

      onChange(formatted);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    // Pad on blur
    let raw = value.replace(/[^\d]/g, '');
    if (raw.length === 0) {
      onChange('00:00');
      return;
    }
    if (raw.length <= 2) {
      let hh = parseInt(raw, 10);
      if (hh > 23) hh = 23;
      onChange(String(hh).padStart(2, '0') + ':00');
      return;
    }
    if (raw.length === 3) {
      raw = raw + '0';
    }
    let hh = parseInt(raw.slice(0, 2), 10);
    let mm = parseInt(raw.slice(2, 4), 10);
    if (hh > 23) hh = 23;
    if (mm > 59) mm = 59;
    onChange(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
  }, [value, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      maxLength={5}
      className={cn(
        'flex h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 text-center font-mono',
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
