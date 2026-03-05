'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { scheduleFormSchema, type ScheduleFormData } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ScheduleFormProps {
  onSubmit: (data: ScheduleFormData) => void;
  defaultValues?: Partial<ScheduleFormData>;
  onPeopleCountChange?: (count: number) => void;
}

export function ScheduleForm({ onSubmit, defaultValues, onPeopleCountChange }: ScheduleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      peopleCount: 4,
      hoursPerShift: 8,
      durationDays: 4,
      minBreakHours: 11,
      ...defaultValues,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Parametry harmonogramu</CardTitle>
        <CardDescription>Ustaw parametry wycieczki i zmian roboczych</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Liczba osób */}
            <div className="space-y-2">
              <Label htmlFor="peopleCount">Liczba osób</Label>
              <Input
                id="peopleCount"
                type="number"
                min={2}
                max={20}
                {...register('peopleCount', {
                  valueAsNumber: true,
                  onChange: (e) => onPeopleCountChange?.(Number(e.target.value)),
                })}
              />
              {errors.peopleCount && (
                <p className="text-sm text-destructive">{errors.peopleCount.message}</p>
              )}
            </div>

            {/* Długość zmiany */}
            <div className="space-y-2">
              <Label htmlFor="hoursPerShift">Długość zmiany (h)</Label>
              <Input
                id="hoursPerShift"
                type="number"
                min={4}
                max={12}
                {...register('hoursPerShift', { valueAsNumber: true })}
              />
              {errors.hoursPerShift && (
                <p className="text-sm text-destructive">{errors.hoursPerShift.message}</p>
              )}
            </div>

            {/* Czas trwania */}
            <div className="space-y-2">
              <Label htmlFor="durationDays">Czas trwania (doby)</Label>
              <Input
                id="durationDays"
                type="number"
                min={1}
                max={14}
                {...register('durationDays', { valueAsNumber: true })}
              />
              {errors.durationDays && (
                <p className="text-sm text-destructive">{errors.durationDays.message}</p>
              )}
            </div>

            {/* Minimalna przerwa */}
            <div className="space-y-2">
              <Label htmlFor="minBreakHours">Min. przerwa (h)</Label>
              <Input
                id="minBreakHours"
                type="number"
                min={8}
                max={24}
                {...register('minBreakHours', { valueAsNumber: true })}
              />
              {errors.minBreakHours && (
                <p className="text-sm text-destructive">{errors.minBreakHours.message}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full sm:w-auto" size="lg">
            Generuj harmonogram
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
