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
}

export function ScheduleForm({ onSubmit, defaultValues }: ScheduleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      durationDays: 4,
      ...defaultValues,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Parametry harmonogramu</CardTitle>
        <CardDescription>Ustaw czas trwania wycieczki</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="max-w-xs space-y-2">
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

          <Button type="submit" className="w-full sm:w-auto" size="lg">
            Generuj harmonogram
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
