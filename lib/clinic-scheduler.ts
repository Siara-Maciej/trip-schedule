import type {
  ClinicEmployee,
  ClinicConfig,
  ClinicShift,
  ClinicScheduleResult,
} from '@/types/clinic';

const DAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

function parseHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

/**
 * Simple greedy clinic scheduler.
 * For each work day, assigns employees to shifts respecting:
 * - weekly hour limits
 * - unavailable days
 * - shift preferences
 * - minimum staff requirement
 */
export function generateClinicSchedule(
  employees: ClinicEmployee[],
  config: ClinicConfig,
): ClinicScheduleResult {
  const openH = parseHour(config.openTime);
  const closeH = parseHour(config.closeTime);
  const midH = Math.floor((openH + closeH) / 2);

  const shifts: ClinicShift[] = [];
  const warnings: string[] = [];
  const hoursUsed = new Map<string, number>();

  for (const emp of employees) {
    hoursUsed.set(emp.id, 0);
  }

  // Sort work days
  const workDays = [...config.workDays].sort((a, b) => a - b);

  for (const day of workDays) {
    // Get available employees for this day
    const available = employees.filter(
      (emp) => !emp.unavailableDays.includes(day)
    );

    if (available.length === 0) {
      warnings.push(`Brak dostępnych pracowników w ${DAY_NAMES[day]}`);
      continue;
    }

    // Sort by hours used (ascending) to distribute evenly
    available.sort(
      (a, b) => (hoursUsed.get(a.id) ?? 0) - (hoursUsed.get(b.id) ?? 0)
    );

    let assigned = 0;

    for (const emp of available) {
      const currentHours = hoursUsed.get(emp.id) ?? 0;

      // Determine shift based on preference
      let startH = openH;
      let endH = closeH;

      const pref = emp.shiftPreferences[0];
      if (pref === 'rano') {
        startH = openH;
        endH = midH;
      } else if (pref === 'popoludnie') {
        startH = midH;
        endH = closeH;
      }
      // 'caly_dzien' keeps full range

      const shiftHours = endH - startH;

      // Check weekly limit
      if (currentHours + shiftHours > emp.weeklyHours) {
        // Try shorter shift if possible
        const remaining = emp.weeklyHours - currentHours;
        if (remaining >= 4) {
          // Assign partial shift
          endH = startH + remaining;
        } else {
          continue;
        }
      }

      const actualHours = endH - startH;
      shifts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        day,
        startHour: startH,
        endHour: endH,
      });

      hoursUsed.set(emp.id, currentHours + actualHours);
      assigned++;
    }

    if (assigned < config.minStaffPerShift) {
      warnings.push(
        `${DAY_NAMES[day]}: przypisano ${assigned}/${config.minStaffPerShift} wymaganych pracowników`
      );
    }
  }

  // Build week label
  const weekDate = config.weekStartDate
    ? new Date(config.weekStartDate)
    : new Date();
  const endDate = new Date(weekDate);
  endDate.setDate(endDate.getDate() + 6);
  const weekLabel = `${weekDate.toLocaleDateString('pl-PL')} — ${endDate.toLocaleDateString('pl-PL')}`;

  return { shifts, weekLabel, warnings };
}
