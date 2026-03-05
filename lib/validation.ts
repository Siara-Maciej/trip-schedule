import { z } from 'zod';

export const scheduleFormSchema = z
  .object({
    peopleCount: z
      .number({ error: 'Podaj liczbę osób' })
      .min(2, 'Minimalna liczba osób to 2')
      .max(20, 'Maksymalna liczba osób to 20'),
    hoursPerShift: z
      .number({ error: 'Podaj długość zmiany' })
      .min(4, 'Minimalna długość zmiany to 4 godziny')
      .max(12, 'Maksymalna długość zmiany to 12 godzin'),
    durationDays: z
      .number({ error: 'Podaj liczbę dób' })
      .min(1, 'Minimalna liczba dób to 1')
      .max(14, 'Maksymalna liczba dób to 14'),
    minBreakHours: z
      .number({ error: 'Podaj minimalną przerwę' })
      .min(8, 'Minimalna przerwa to 8 godzin')
      .max(24, 'Maksymalna przerwa to 24 godziny'),
    customNames: z.string().optional(),
  })
  .refine(
    (data) => data.peopleCount * data.hoursPerShift >= 24,
    {
      message: 'Liczba osób × długość zmiany musi wynosić co najmniej 24 (żeby pokryć całą dobę)',
      path: ['peopleCount'],
    }
  )
  .refine(
    (data) => data.minBreakHours >= data.hoursPerShift,
    {
      message: 'Minimalna przerwa musi być >= długość zmiany',
      path: ['minBreakHours'],
    }
  );

export type ScheduleFormData = z.infer<typeof scheduleFormSchema>;
