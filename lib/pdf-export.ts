import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ScheduleResult, PersonConfig } from '@/types/schedule';

interface PdfExportParams {
  result: ScheduleResult;
  durationDays: number;
  persons: PersonConfig[];
  startDate?: string;
  endDate?: string;
}

export function generatePDF({
  result,
  durationDays,
  persons,
  startDate,
  endDate,
}: PdfExportParams) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 15;

  // --- Tytuł ---
  doc.setFontSize(18);
  doc.text('Harmonogram Pracy', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // --- Parametry wejściowe ---
  doc.setFontSize(10);
  doc.setTextColor(100);

  const paramLines: string[] = [];
  if (startDate && endDate) {
    paramLines.push(`Okres: ${startDate} — ${endDate}`);
  }
  paramLines.push(`Liczba dni: ${durationDays}`);
  paramLines.push(`Liczba osob: ${persons.length}`);

  for (const line of paramLines) {
    doc.text(line, 14, y);
    y += 5;
  }

  // --- Parametry osób ---
  y += 3;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Parametry osob', 14, y);
  y += 2;

  const personParamRows = persons.map((p, i) => [
    p.name.trim() || `Osoba ${i + 1}`,
    `${p.hoursPerShift}h`,
    `${p.minBreakHours}h`,
    p.canWorkAtNight ? 'Tak' : 'Nie',
    p.blockedHours
      ? `${String(p.blockedHours.startHour).padStart(2, '0')}:00 — ${String(p.blockedHours.endHour).padStart(2, '0')}:00`
      : '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Osoba', 'Zmiana', 'Min. przerwa', 'Praca nocna', 'Blokada godzin']],
    body: personParamRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // --- Statystyki podsumowanie ---
  const totalHours = durationDays * 24;
  const coveredHours = totalHours - result.coverageGaps.length;
  const coveragePercent = totalHours > 0 ? Math.round((coveredHours / totalHours) * 100) : 0;
  const totalWorkHours = result.stats.reduce((sum, s) => sum + s.totalWorkHours, 0);

  doc.setFontSize(12);
  doc.text('Podsumowanie', 14, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Pokrycie', 'Osoby', 'Roboczogodziny', 'Bloki pracy', 'Status']],
    body: [
      [
        `${coveragePercent}%`,
        `${result.stats.length}`,
        `${totalWorkHours}h`,
        `${result.shifts.length}`,
        result.valid ? 'OK' : 'Problemy',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // --- Błędy / luki ---
  if (result.errors.length > 0 || result.coverageGaps.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(180, 0, 0);
    if (result.errors.length > 0) {
      doc.text('Bledy:', 14, y);
      y += 5;
      for (const err of result.errors) {
        doc.setFontSize(8);
        doc.text(`• ${err}`, 18, y);
        y += 4;
      }
    }
    if (result.coverageGaps.length > 0) {
      doc.text('Luki pokrycia:', 14, y);
      y += 5;
      doc.setFontSize(8);
      for (const gap of result.coverageGaps.slice(0, 20)) {
        doc.text(`• Dzien ${gap.day}, ${gap.startHour}:00 — ${gap.endHour}:00`, 18, y);
        y += 4;
      }
      if (result.coverageGaps.length > 20) {
        doc.text(`... i ${result.coverageGaps.length - 20} wiecej`, 18, y);
        y += 4;
      }
    }
    doc.setTextColor(0);
    y += 4;
  }

  // --- Statystyki per osoba ---
  doc.setFontSize(12);
  doc.text('Statystyki per osoba', 14, y);
  y += 2;

  const statsRows = result.stats.map((s) => [
    s.personName,
    `${s.shiftsCount}`,
    `${s.totalWorkHours}h`,
    s.shiftsCount > 1 ? `${s.minBreakActual}h` : '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Osoba', 'Blokow pracy', 'Lacznie godzin', 'Min. przerwa']],
    body: statsRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // --- Tabela harmonogramu (per dzień, bo jest szeroka) ---
  const workSet = new Set<string>();
  for (const shift of result.shifts) {
    for (let h = shift.startHour; h < shift.endHour; h++) {
      workSet.add(`${shift.personId}-${shift.day}-${h}`);
    }
  }

  const personsList = result.stats.map((s) => ({
    id: s.personId,
    name: s.personName,
  }));

  for (let d = 1; d <= durationDays; d++) {
    // Nowa strona jeśli brak miejsca
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(12);
    doc.text(`Harmonogram — Dzien ${d}`, 14, y);
    y += 2;

    const hourHeaders = ['Osoba', ...Array.from({ length: 24 }, (_, h) => `${h}`)];

    const scheduleRows = personsList.map((person) => {
      const cells = [person.name];
      for (let h = 0; h < 24; h++) {
        cells.push(workSet.has(`${person.id}-${d}-${h}`) ? 'X' : '');
      }
      return cells;
    });

    autoTable(doc, {
      startY: y,
      head: [hourHeaders],
      body: scheduleRows,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], fontSize: 6, cellPadding: 1 },
      bodyStyles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      columnStyles: {
        0: { halign: 'left', cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw === 'X') {
          data.cell.styles.fillColor = [134, 239, 172]; // green-300
          data.cell.styles.textColor = [20, 83, 45];
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // --- Stopka na każdej stronie ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Strona ${i} z ${pageCount} — Wygenerowano: ${new Date().toLocaleString('pl-PL')}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' },
    );
  }

  return doc;
}

export function downloadPDF(params: PdfExportParams, filename: string) {
  const doc = generatePDF(params);
  doc.save(filename);
}
