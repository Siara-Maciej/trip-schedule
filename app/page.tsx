'use client';

import Link from 'next/link';
import { Users, CalendarPlus, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const modules = [
  {
    title: 'Osoby',
    description: 'Zarządzaj pracownikami — dodawaj, edytuj, ustalaj dostępność i limity godzin.',
    href: '/people',
    icon: Users,
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  },
  {
    title: 'Nowy grafik',
    description: 'Kreator harmonogramu: ustaw okres, zmiany, wymagania kadrowe, przypisz osoby i wygeneruj.',
    href: '/schedule',
    icon: CalendarPlus,
    color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  },
];

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Generator harmonogramów pracy
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Card
            key={m.href}
            className="group relative overflow-hidden border-border/60 transition-shadow hover:shadow-lg"
          >
            <CardHeader className="pb-3">
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${m.color}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{m.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {m.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={m.href}>
                <Button variant="outline" className="gap-2">
                  Otwórz
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
