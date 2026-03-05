import { z } from 'zod';

export const scheduleFormSchema = z.object({
  durationDays: z
    .number({ error: 'Podaj liczbę dób' })
    .min(1, 'Minimalna liczba dób to 1')
    .max(14, 'Maksymalna liczba dób to 14'),
});

export type ScheduleFormData = z.infer<typeof scheduleFormSchema>;
