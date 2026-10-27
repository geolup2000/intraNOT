import { DISCIPLINE_LEGEND } from './discipline-legend.mjs';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = Object.keys(DISCIPLINE_LEGEND).sort((a,b) => b.length-a.length).map(escapeRegExp).join('|');
// Underscores separate schedule fields; letters, numbers and hyphens belong
// to a code. INFO-A must not match INFO-A1 or INFO-A-extra.
const codePattern = new RegExp(`(?<![\\p{L}\\p{N}-])(${alternatives})(?![\\p{L}\\p{N}-])`, 'giu');

export function decodeDisciplineCodes(text) {
  const matches = [];
  const title = text.replace(codePattern, code => {
    const entry = DISCIPLINE_LEGEND[code.toUpperCase()];
    if (!matches.some(match => match.code === entry.code)) matches.push(entry);
    return entry.names.join(' / ');
  });
  return { title, matches };
}
