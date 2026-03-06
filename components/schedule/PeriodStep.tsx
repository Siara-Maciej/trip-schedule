'use client';

import { useState } from 'react';
import {
  CalendarRange,
  CalendarDays,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Check,
  Users,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type {
  PeriodType,
  PeriodConfig,
  WorkingHoursType,
  WorkingHoursConfig,
  ShiftDefinition,
  DayConfig,
  StaffConstraints,
  ScheduleTemplate,
} from '@/types/schedule-plan';

// ── Helpers ────────────────────────────────────────────

const PERIOD_OPTIONS: { value: PeriodType; label: string; icon: typeof CalendarRange; desc: string }[] = [
  { value: 'daterange', label: 'Zakres dat', icon: CalendarRange, desc: 'Od — do z godziną' },
  { value: 'weekly', label: 'Tygodniowy', icon: CalendarDays, desc: 'Wybierz tydzień' },
  { value: 'monthly', label: 'Miesięczny', icon: CalendarIcon, desc: 'Cały miesiąc' },
];

const HOURS_OPTIONS: { value: WorkingHoursType; label: string; desc: string }[] = [
  { value: 'continuous', label: '24h', desc: 'Ciągłe pokrycie całodobowe' },
  { value: 'fixed', label: 'Stałe godziny', desc: 'Te same godziny każdego dnia' },
  { value: 'shifts', label: 'Zmiany', desc: 'Kilka zmian w ciągu dnia' },
  { value: 'custom', label: 'Indywidualnie', desc: 'Różne godziny na każdy dzień' },
];

const DAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function defaultShift(required = true): ShiftDefinition {
  return { name: 'Zmiana', startTime: '08:00', endTime: '16:00', required, minPerPersonInPeriod: 0 };
}

function defaultDayConfig(): DayConfig {
  return { enabled: true, shifts: [defaultShift()] };
}

// ── Component ──────────────────────────────────────────

export interface PeriodStepData {
  period: PeriodConfig;
  workingHours: WorkingHoursConfig;
  constraints: StaffConstraints;
}

interface PeriodStepProps {
  templates: ScheduleTemplate[];
  onSaveTemplate: (t: ScheduleTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onNext: (data: PeriodStepData) => void;
}

export function PeriodStep({ templates, onSaveTemplate, onDeleteTemplate, onNext }: PeriodStepProps) {
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Period
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('08:00');
  const [weekStart, setWeekStart] = useState<Date | undefined>();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [includeWeekends, setIncludeWeekends] = useState(false);

  // Working hours
  const [hoursType, setHoursType] = useState<WorkingHoursType>('shifts');
  const [fixedStart, setFixedStart] = useState('08:00');
  const [fixedEnd, setFixedEnd] = useState('20:00');
  const [shifts, setShifts] = useState<ShiftDefinition[]>([
    { name: 'Zmiana I', startTime: '07:00', endTime: '15:00', required: true, minPerPersonInPeriod: 0 },
    { name: 'Zmiana II', startTime: '12:00', endTime: '20:00', required: true, minPerPersonInPeriod: 0 },
  ]);
  const [customDays, setCustomDays] = useState<Record<number, DayConfig>>(() => {
    const days: Record<number, DayConfig> = {};
    for (let i = 0; i < 7; i++) days[i] = defaultDayConfig();
    return days;
  });

  // Constraints
  const [minStaff, setMinStaff] = useState(2);
  const [maxStaff, setMaxStaff] = useState(3);
  const [oneShiftPerDay, setOneShiftPerDay] = useState(true);
  const [fairDistribution, setFairDistribution] = useState(true);

  // Template name for saving
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // ── Apply template ──
  const applyTemplate = (t: ScheduleTemplate) => {
    setSelectedTemplateId(t.id);
    setPeriodType(t.periodType);
    setIncludeWeekends(t.includeWeekends);
    setMinStaff(t.constraints.minPerShift);
    setMaxStaff(t.constraints.maxPerShift);
    setOneShiftPerDay(t.constraints.oneShiftPerDay ?? true);
    setFairDistribution(t.constraints.fairDistribution ?? true);

    const wh = t.workingHours;
    setHoursType(wh.type);
    if (wh.type === 'fixed') {
      setFixedStart(wh.startTime);
      setFixedEnd(wh.endTime);
    } else if (wh.type === 'shifts') {
      setShifts([...wh.shifts]);
    } else if (wh.type === 'custom') {
      setCustomDays({ ...wh.days });
    }
  };

  // ── Build data ──
  const buildPeriod = (): PeriodConfig | null => {
    if (periodType === 'daterange') {
      if (!startDate || !endDate) return null;
      return {
        type: 'daterange',
        startDate: startDate.toISOString().slice(0, 10),
        startTime,
        endDate: endDate.toISOString().slice(0, 10),
        endTime,
      };
    }
    if (periodType === 'weekly') {
      if (!weekStart) return null;
      return {
        type: 'weekly',
        weekStartDate: getMonday(weekStart).toISOString().slice(0, 10),
        includeWeekends,
      };
    }
    return {
      type: 'monthly',
      year: selectedYear,
      month: selectedMonth,
      includeWeekends,
    };
  };

  const buildWorkingHours = (): WorkingHoursConfig => {
    if (hoursType === 'continuous') return { type: 'continuous' };
    if (hoursType === 'fixed') return { type: 'fixed', startTime: fixedStart, endTime: fixedEnd };
    if (hoursType === 'shifts') return { type: 'shifts', shifts: [...shifts] };
    return { type: 'custom', days: { ...customDays } };
  };

  const handleNext = () => {
    const period = buildPeriod();
    if (!period) return;
    onNext({
      period,
      workingHours: buildWorkingHours(),
      constraints: { minPerShift: minStaff, maxPerShift: maxStaff, oneShiftPerDay, fairDistribution },
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const t: ScheduleTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      periodType,
      workingHours: buildWorkingHours(),
      constraints: { minPerShift: minStaff, maxPerShift: maxStaff, oneShiftPerDay, fairDistribution },
      includeWeekends,
      createdAt: new Date().toISOString(),
    };
    onSaveTemplate(t);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  // ── Shift editor (reused for shifts and custom) ──
  const renderShiftEditor = (
    shiftList: ShiftDefinition[],
    onChange: (list: ShiftDefinition[]) => void,
  ) => (
    <div className="space-y-3">
      {shiftList.map((s, i) => {
        const isRequired = s.required ?? true;
        return (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            {/* Row 1: Name + times + delete */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={s.name}
                onChange={(e) => {
                  const copy = [...shiftList];
                  copy[i] = { ...copy[i], name: e.target.value };
                  onChange(copy);
                }}
                className="w-full bg-background sm:w-32"
                placeholder="Nazwa"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={s.startTime}
                  onChange={(e) => {
                    const copy = [...shiftList];
                    copy[i] = { ...copy[i], startTime: e.target.value };
                    onChange(copy);
                  }}
                  className="w-28 bg-background"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="time"
                  value={s.endTime}
                  onChange={(e) => {
                    const copy = [...shiftList];
                    copy[i] = { ...copy[i], endTime: e.target.value };
                    onChange(copy);
                  }}
                  className="w-28 bg-background"
                />
                {shiftList.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => onChange(shiftList.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Row 2: Required/Optional toggle + quota */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isRequired}
                  onCheckedChange={(v) => {
                    const copy = [...shiftList];
                    copy[i] = { ...copy[i], required: v, minPerPersonInPeriod: v ? 0 : (copy[i].minPerPersonInPeriod ?? 0) };
                    onChange(copy);
                  }}
                />
                <Badge variant={isRequired ? 'default' : 'secondary'} className="text-xs">
                  {isRequired ? 'Wymagana' : 'Opcjonalna'}
                </Badge>
              </div>
              {isRequired ? (
                <span className="text-xs text-muted-foreground">
                  Musi być obsadzona każdego dnia
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    Min. razy/os. w okresie:
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={s.minPerPersonInPeriod ?? 0}
                    onChange={(e) => {
                      const copy = [...shiftList];
                      copy[i] = { ...copy[i], minPerPersonInPeriod: Number(e.target.value) };
                      onChange(copy);
                    }}
                    className="w-16 bg-background"
                  />
                  <span className="text-xs text-muted-foreground">
                    {(s.minPerPersonInPeriod ?? 0) === 0 ? '(tylko w razie potrzeby)' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...shiftList, defaultShift()])}
      >
        <Plus className="h-3.5 w-3.5" />
        Dodaj zmianę
      </Button>
    </div>
  );

  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* ── Templates ── */}
      {templates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" />
              Zapisane szablony
            </CardTitle>
            <CardDescription>Wybierz szablon, aby załadować konfigurację</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => {
                const isSelected = selectedTemplateId === t.id;
                const periodLabel = PERIOD_OPTIONS.find((p) => p.value === t.periodType)?.label ?? t.periodType;
                const hoursLabel = HOURS_OPTIONS.find((h) => h.value === t.workingHours.type)?.label ?? t.workingHours.type;

                let hoursDetail = '';
                if (t.workingHours.type === 'fixed') {
                  hoursDetail = `${t.workingHours.startTime} – ${t.workingHours.endTime}`;
                } else if (t.workingHours.type === 'shifts') {
                  hoursDetail = t.workingHours.shifts.map((s) => s.name).join(', ');
                }

                return (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      'group relative rounded-lg border p-4 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}

                    <p className="pr-6 text-sm font-semibold">{t.name}</p>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarRange className="h-3 w-3 shrink-0" />
                        <span>{periodLabel}</span>
                        {t.includeWeekends && (
                          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">+weekend</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{hoursLabel}{hoursDetail ? ` · ${hoursDetail}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        <span>{t.constraints.minPerShift}–{t.constraints.maxPerShift} os./zmianę</span>
                        {(t.constraints.oneShiftPerDay ?? true) && (
                          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">1/dzień</Badge>
                        )}
                        {(t.constraints.fairDistribution ?? true) && (
                          <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">rotacja</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60">
                        {new Date(t.createdAt).toLocaleDateString('pl-PL')}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTemplate(t.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Period type ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Okres</CardTitle>
          <CardDescription>Wybierz typ okresu dla grafiku</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriodType(opt.value)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  periodType === opt.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <opt.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    periodType === opt.value ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <Separator />

          {/* Date range details */}
          {periodType === 'daterange' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Data rozpoczęcia</Label>
                <div className="flex gap-2">
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start font-normal">
                        {startDate ? startDate.toLocaleDateString('pl-PL') : 'Wybierz'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(d) => { setStartDate(d); setStartOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-24 bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Data zakończenia</Label>
                <div className="flex gap-2">
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start font-normal">
                        {endDate ? endDate.toLocaleDateString('pl-PL') : 'Wybierz'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(d) => { setEndDate(d); setEndOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-24 bg-background"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Weekly */}
          {periodType === 'weekly' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Wybierz dowolny dzień tygodnia</Label>
                <Popover open={weekOpen} onOpenChange={setWeekOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start font-normal">
                      {weekStart
                        ? `Tydzień od ${getMonday(weekStart).toLocaleDateString('pl-PL')}`
                        : 'Wybierz tydzień'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={weekStart}
                      onSelect={(d) => { setWeekStart(d); setWeekOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={includeWeekends} onCheckedChange={setIncludeWeekends} />
                <Label className="text-sm">Uwzględnij weekendy (Sob, Ndz)</Label>
              </div>
            </div>
          )}

          {/* Monthly */}
          {periodType === 'monthly' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rok</Label>
                  <Input
                    type="number"
                    min={2024}
                    max={2030}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-24 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Miesiąc</Label>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {MONTHS.map((m, i) => (
                      <Badge
                        key={m}
                        variant={selectedMonth === i + 1 ? 'default' : 'outline'}
                        className="cursor-pointer select-none justify-center px-2 py-1"
                        onClick={() => setSelectedMonth(i + 1)}
                      >
                        {m.slice(0, 3)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={includeWeekends} onCheckedChange={setIncludeWeekends} />
                <Label className="text-sm">Uwzględnij weekendy (Sob, Ndz)</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Working hours ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4" />
            Godziny pracy
          </CardTitle>
          <CardDescription>Jak wyglądają zmiany w ciągu dnia?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOURS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHoursType(opt.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  hoursType === opt.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>

          <Separator />

          {hoursType === 'continuous' && (
            <p className="text-sm text-muted-foreground">
              Pokrycie 24h — od 0:00 do 24:00 każdego dnia.
            </p>
          )}

          {hoursType === 'fixed' && (
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Od</Label>
                <Input
                  type="time"
                  value={fixedStart}
                  onChange={(e) => setFixedStart(e.target.value)}
                  className="w-28 bg-background"
                />
              </div>
              <span className="mt-5 text-muted-foreground">—</span>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Do</Label>
                <Input
                  type="time"
                  value={fixedEnd}
                  onChange={(e) => setFixedEnd(e.target.value)}
                  className="w-28 bg-background"
                />
              </div>
            </div>
          )}

          {hoursType === 'shifts' && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Zmiany obowiązujące każdego dnia
              </Label>
              {renderShiftEditor(shifts, setShifts)}
            </div>
          )}

          {hoursType === 'custom' && (
            <div className="space-y-4">
              {DAYS.map((dayName, dayIdx) => {
                const day = customDays[dayIdx] ?? defaultDayConfig();
                return (
                  <div key={dayIdx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(v) =>
                          setCustomDays((prev) => ({
                            ...prev,
                            [dayIdx]: { ...day, enabled: v },
                          }))
                        }
                      />
                      <Label className="text-sm font-medium">{dayName}</Label>
                    </div>
                    {day.enabled && (
                      <div className="ml-11">
                        {renderShiftEditor(day.shifts, (newShifts) =>
                          setCustomDays((prev) => ({
                            ...prev,
                            [dayIdx]: { ...day, shifts: newShifts },
                          }))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Staff constraints ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wymagania kadrowe</CardTitle>
          <CardDescription>Liczba pracowników i zasady przydziału zmian</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={minStaff}
                onChange={(e) => setMinStaff(Number(e.target.value))}
                className="w-20 bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Maksimum</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxStaff}
                onChange={(e) => setMaxStaff(Number(e.target.value))}
                className="w-20 bg-background"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Switch
                id="oneShiftPerDay"
                checked={oneShiftPerDay}
                onCheckedChange={setOneShiftPerDay}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="oneShiftPerDay" className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  Maks. 1 zmiana na osobę dziennie
                </Label>
                <p className="text-xs text-muted-foreground">
                  Każda osoba może pracować tylko na jednej zmianie danego dnia
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="fairDistribution"
                checked={fairDistribution}
                onCheckedChange={setFairDistribution}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="fairDistribution" className="flex items-center gap-1.5 text-sm font-medium">
                  <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                  Równomierny przydział zmian
                </Label>
                <p className="text-xs text-muted-foreground">
                  Rotacja typów zmian między osobami — nikt nie dostaje ciągle tej samej zmiany
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showSaveTemplate ? (
            <div className="flex items-center gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nazwa szablonu..."
                className="w-48 bg-background"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              />
              <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                <Save className="mr-1 h-3.5 w-3.5" />
                Zapisz
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                Anuluj
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Zapisz jako szablon
            </Button>
          )}
        </div>

        <Button size="lg" onClick={handleNext}>
          Dalej — Wybierz osoby
        </Button>
      </div>
    </div>
  );
}
