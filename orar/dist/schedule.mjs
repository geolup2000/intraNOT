import { decodeDisciplineCodes } from './discipline-names.mjs';

// Only the rules confirmed by the user belong here. Keep the original text
// available so abbreviations can be interpreted in a later iteration.
export const PROGRAMS = {
  MSPPS: 'Managementul strategiilor preventive și politici de sănătate',
};

const clean = text => text.normalize('NFKC').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();
const plain = text => clean(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const DAY_NAMES = ['luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata', 'duminica'];
const TIME_RANGE = /^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?(?=$|[\s_,;-])/;

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseActivity(text) {
  const raw = clean(text);
  const time = raw.match(TIME_RANGE);
  if (!time) return null;
  const startMinutes = Number(time[1]) * 60 + Number(time[2] || 0);
  const endMinutes = Number(time[3]) * 60 + Number(time[4] || 0);
  if (Number(time[1]) > 23 || Number(time[3]) > 23 || Number(time[2] || 0) > 59 || Number(time[4] || 0) > 59 || endMinutes <= startMinutes) return null;
  const formatTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const body = raw.slice(time[0].length).replace(/^[\s_,;-]+/, '');
  const programs = [...new Set([...body.matchAll(/(?<![A-Za-z0-9])(MSPPS|MSIP)(?:\d+)?(?=$|[^A-Za-z0-9])/gi)].map(match => match[1].toUpperCase()))];
  const groups = [...new Set([...body.matchAll(/(?:^|[\s_,;])gr\.?\s*([1-4](?:\s*[,/&]\s*[1-4])*)(?=$|[^\d])/gi)]
    .flatMap(match => match[1].match(/[1-4]/g)))].sort();
  const course = /(?:^|[\s_,;])c(?=$|[\s_,;])/i.test(body);
  const seminar = /(?:^|[\s_,;])s(?=$|[\s_,;1-4])/i.test(body);
  const type = course && !seminar ? 'Curs' : seminar && !course ? 'Seminar' : 'Activitate';
  // Do not infer that bare numbers (MSPPS_1, S1, S 1,2) are groups.
  // Their meaning remains visible in the original notation.
  const title = body
    .replace(/(?<![A-Za-z0-9])(?:MSPPS|MSIP)(?:\d+)?(?=$|[^A-Za-z0-9])/gi, '')
    .replace(/(?:^|[\s_,;])gr\.?\s*[1-4](?:\s*[,/&]\s*[1-4])*/gi, ' ')
    .replace(/(?:^|[\s_,;])(?:c|s)(?:\s*[1-4](?:\s*,\s*[1-4])*)?(?=$|[\s_,;])/gi, ' ')
    .split('_').map(part => part.replace(/^[\s,&;]+|[\s,&;]+$/g, '').trim())
    .filter(part => part && !/^[12]$/.test(part)).join(' · ') || 'Activitate';
  const discipline = decodeDisciplineCodes(title);
  return { raw, title: discipline.title, disciplineMatches: discipline.matches, programs, groups, type, start: formatTime(startMinutes), end: formatTime(endMinutes), startMinutes, endMinutes, year: 2 };
}

function parseWeekRange(text) {
  // Accept the separators present in the supplied table, including 09 -15-11.2026.
  const match = clean(text).match(/^(\d{1,2})(?:\.(\d{1,2})\.?)?\s*-\s*(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/);
  if (!match) return null;
  const [, firstDay, firstMonth, lastDay, lastMonth, year] = match;
  const startMonth = Number(firstMonth || lastMonth);
  const startYear = Number(year) - (firstMonth && startMonth > Number(lastMonth) ? 1 : 0);
  const start = new Date(startYear, startMonth - 1, Number(firstDay), 12);
  const end = new Date(Number(year), Number(lastMonth) - 1, Number(lastDay), 12);
  if (start.getMonth() !== startMonth - 1 || start.getDate() !== Number(firstDay) || end.getMonth() !== Number(lastMonth) - 1 || end.getDate() !== Number(lastDay)) return null;
  const length = Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate()) - Date.UTC(start.getFullYear(),start.getMonth(),start.getDate())) / 86400000);
  return length >= 0 && length <= 6 && start.getDay() === 1 ? { start, end } : null;
}

export function parseSchedule(pages) {
  const events = [], weeks = [], warnings = [];
  let lastStart = null;
  for (const [pageIndex, page] of pages.entries()) {
    const items = page.filter(item => item.str?.trim()).map(item => ({
      text: clean(item.str), x: item.transform[4], y: item.transform[5], height: item.height || Math.abs(item.transform[3]) || 3,
    }));
    const anchors = items.filter(item => /^S\d+$/i.test(item.text)).sort((a,b) => b.y - a.y);
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i], lower = anchors[i+1]?.y ?? -Infinity;
      const block = items.filter(item => item.y <= anchor.y + anchor.height * .4 && item.y > lower + anchor.height * .4);
      const header = block.filter(item => Math.abs(item.y - anchor.y) < anchor.height * .45);
      const columns = DAY_NAMES.map(name => header.find(item => plain(item.text) === name));
      const dateItem = header.find(item => parseWeekRange(item.text));
      const range = dateItem && parseWeekRange(dateItem.text);
      if (!range || columns.some(column => !column) || columns.some((column,index) => index > 0 && column.x <= columns[index-1].x)) {
        warnings.push(`${anchor.text}: antetul cu date și zile nu a putut fi interpretat.`);
        continue;
      }
      if (lastStart && range.start <= lastStart) {
        warnings.push(`${anchor.text}: data „${dateItem.text}” este înaintea săptămânii precedente. Săptămâna nu a fost importată; verifică anul din PDF.`);
        continue;
      }
      const yearOne = block.find(item => item.text === 'I' && item.x < columns[0].x);
      const yearTwo = block.find(item => item.text === 'II' && item.x < columns[0].x);
      if (!yearOne || !yearTwo || yearTwo.y >= yearOne.y) {
        warnings.push(`${anchor.text}: rândul anului II nu a putut fi identificat în siguranță.`);
        continue;
      }
      const cutoff = (yearOne.y + yearTwo.y) / 2;
      const week = { label: anchor.text, start: dateKey(range.start), end: dateKey(range.end), page: pageIndex + 1 };
      weeks.push(week);
      lastStart = range.start;
      // Column starts come from each week's own header; never flatten the PDF
      // to text, which loses the day/row of each activity.
      for (let dayIndex = 0; dayIndex < columns.length; dayIndex++) {
        const left = columns[dayIndex].x - anchor.height;
        const right = (columns[dayIndex+1]?.x ?? Infinity) - anchor.height;
        const lines = block.filter(item => item.y < cutoff && item.x >= left && item.x < right)
          .sort((a,b) => Math.abs(a.y-b.y) < anchor.height * .3 ? a.x-b.x : b.y-a.y);
        const mergedLines = [];
        for (const line of lines) {
          const previous = mergedLines.at(-1);
          if (previous && Math.abs(previous.y-line.y) < anchor.height * .3) previous.text += ` ${line.text}`;
          else mergedLines.push({ ...line });
        }
        const entries = [];
        for (const line of mergedLines) {
          if (TIME_RANGE.test(line.text)) entries.push(line.text);
          else if (entries.length) entries[entries.length-1] += ` ${line.text}`;
        }
        const date = new Date(range.start); date.setDate(date.getDate() + dayIndex);
        for (const text of entries) {
          const activity = parseActivity(text);
          if (!activity) { warnings.push(`${anchor.text}, ${DAY_NAMES[dayIndex]}: interval orar nevalid („${text}”).`); continue; }
          if (date > range.end) { warnings.push(`${anchor.text}: o activitate este în afara intervalului din antet.`); continue; }
          events.push({ ...activity, id: `${pageIndex}-${i}-${dayIndex}-${entries.indexOf(text)}`, date: dateKey(date), week: anchor.text, page: pageIndex + 1 });
        }
      }
    }
  }
  if (!weeks.length) throw new Error('Nu am identificat tabelul cu săptămâni și rândurile anului II. Folosește un PDF cu aceeași structură ca documentul furnizat.');
  if (!events.length) throw new Error('Tabelul a fost identificat, dar nu conține activități cu intervale orare valide pentru anul II.');
  const ambiguousCodes = new Map(events.flatMap(event => event.disciplineMatches).filter(match => match.names.length > 1).map(match => [match.code, match]));
  for (const [code, entry] of ambiguousCodes) warnings.push(`Codul ${code} are ${entry.names.length} denumiri în legendă. Sunt afișate ambele: ${entry.names.join(' / ')}.`);
  events.sort((a,b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.raw.localeCompare(b.raw));
  return { events, weeks, warnings };
}

export function eventsForDate(schedule, date, group) {
  const key = typeof date === 'string' ? date : dateKey(date);
  return schedule.events.filter(event => event.date === key && (!event.groups.length || event.groups.includes(String(group))));
}
