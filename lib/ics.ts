/**
 * Minimal RFC-5545 .ics generation — zero deps, zero cost. Builds a study
 * plan of daily blocks from the user's remaining topics up to a target date.
 */

function icsDate(d: Date): string {
  // Floating local time (no Z) so it lands at the same wall-clock for everyone.
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
}

function escape(s: string): string {
  return s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

export interface StudyBlock {
  title: string;
  description: string;
  /** local date at 18:00 */
  date: Date;
  minutes: number;
}

export function buildStudyIcs(blocks: StudyBlock[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//dryrun AI//Study Plan//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const b of blocks) {
    const start = new Date(b.date);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + b.minutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@dryrun-ai`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escape(b.title)}`,
      `DESCRIPTION:${escape(b.description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Interview prep",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
