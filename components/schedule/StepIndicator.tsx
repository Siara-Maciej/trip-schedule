'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number; // 0-based
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <nav className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={cn(
                    'hidden h-px w-8 sm:block lg:w-16',
                    done ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    done && 'bg-primary text-primary-foreground',
                    active && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                    !done && !active && 'bg-muted text-muted-foreground'
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={cn(
                      'text-sm font-medium leading-none',
                      active ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
