// Compare parser reports, not program behavior. Deliberately prefer uncertainty
// to inventing an identity for repeated or changed diagnostics. No clock budget,
// fuzzy matching, source execution, or dependencies are involved.

export function diagnosticMessageKey(message) {
  // Babel and JSON.parse include source coordinates in otherwise identical
  // messages. Remove only their terminal coordinate forms, not numbers in the
  // diagnostic itself (such as an invalid numeric value or identifier).
  return message
    .replace(/\s+\(line \d+ column \d+\)$/i, '')
    .replace(/\s+at position \d+$/i, '')
    .replace(/\s+at line \d+ column \d+$/i, '')
    .replace(/\s+\(\d+:\d+\)$/, '');
}

function describe(source, result) {
  const lines = source.split('\n');
  const starts = [0];
  const occurrences = new Map();
  for (let i = 0; i < lines.length; i++) {
    occurrences.set(lines[i], (occurrences.get(lines[i]) || 0) + 1);
    if (i + 1 < lines.length) starts.push(starts[i] + lines[i].length + 1);
  }
  let invalid = !result || !Array.isArray(result.diagnostics);
  const records = [];
  for (const diagnostic of Array.isArray(result?.diagnostics) ? result.diagnostics : []) {
    if (!diagnostic || typeof diagnostic !== 'object') { invalid = true; continue; }
    const { from, to, message, severity } = diagnostic;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > source.length ||
        typeof message !== 'string' || !['error', 'warning', 'info', 'hint'].includes(severity)) {
      invalid = true;
      continue;
    }
    let lo = 0, hi = starts.length;
    while (lo + 1 < hi) {
      const middle = (lo + hi) >>> 1;
      if (starts[middle] <= from) lo = middle;
      else hi = middle;
    }
    const column = from - starts[lo] + 1;
    const messageKey = JSON.stringify([severity, diagnosticMessageKey(message)]);
    records.push({
      diagnostic: { from, to, message, severity },
      line: lo + 1, column,
      messageKey,
      fingerprint: JSON.stringify([messageKey, lines[lo], column, source.slice(from, to)]),
      uniqueLine: occurrences.get(lines[lo]) === 1,
    });
  }
  records.sort((a, b) => a.diagnostic.from - b.diagnostic.from || a.diagnostic.to - b.diagnostic.to ||
    (a.messageKey < b.messageKey ? -1 : a.messageKey > b.messageKey ? 1 : 0));
  return { records, invalid };
}

const location = record => record && ({ ...record.diagnostic, line: record.line, column: record.column });
const item = (category, a, b, reason) => ({ category, a: location(a), b: location(b), reason });

/** Inputs use the LF-normalized UTF-16 strings submitted to the syntax worker. */
export function compareSyntax({ sourceA, sourceB, resultA, resultB }) {
  const a = describe(sourceA, resultA), b = describe(sourceB, resultB);
  const report = {
    status: 'compared', limited: Boolean(resultA?.limited || resultB?.limited),
    introduced: [], resolved: [], persistent: [], uncertain: [], reason: '',
  };
  if (a.invalid || b.invalid) {
    report.status = 'incomplete'; report.reason = 'A parser report was missing or invalid. No comparison conclusion is available.';
  } else if ([resultA.status, resultB.status].includes('unsupported')) {
    report.status = 'unavailable'; report.reason = 'Syntax comparison is not available for the selected language.';
  } else if ([resultA.status, resultB.status].includes('empty')) {
    report.status = 'unavailable'; report.reason = 'Add non-empty code to both A and B. An empty file is not evidence that an issue was fixed.';
  } else if (resultA.status !== 'checked' || resultB.status !== 'checked') {
    report.status = 'incomplete'; report.reason = 'Both syntax checks must finish before their reports can be compared.';
  } else if (resultA.truncated || resultB.truncated) {
    report.status = 'incomplete'; report.reason = 'A diagnostic list was truncated. Missing entries cannot be classified as newly reported or no longer reported.';
  }
  if (report.status !== 'compared') {
    report.uncertain = [
      ...a.records.map(record => item('uncertain', record, null, report.reason)),
      ...b.records.map(record => item('uncertain', null, record, report.reason)),
    ];
    return report;
  }

  const group = records => {
    const groups = new Map();
    for (const record of records) {
      const key = record.fingerprint;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    return groups;
  };
  const groupsA = group(a.records), groupsB = group(b.records);
  const matchedA = new Set(), matchedB = new Set();
  for (const recordA of a.records) {
    const candidatesA = groupsA.get(recordA.fingerprint);
    const candidatesB = groupsB.get(recordA.fingerprint) || [];
    let recordB;
    if (sourceA === sourceB) {
      // Identical documents also disambiguate repeated lines by exact offsets.
      recordB = candidatesB.find(candidate => !matchedB.has(candidate) &&
        candidate.diagnostic.from === recordA.diagnostic.from && candidate.diagnostic.to === recordA.diagnostic.to);
    } else if (candidatesA.length === 1 && candidatesB.length === 1 && recordA.uniqueLine && candidatesB[0].uniqueLine) {
      recordB = candidatesB[0];
    }
    if (!recordB) continue;
    matchedA.add(recordA); matchedB.add(recordB);
    report.persistent.push(item('persistent', recordA, recordB, 'The same diagnostic is reported on matching source text.'));
  }

  const remainingA = a.records.filter(record => !matchedA.has(record));
  const remainingB = b.records.filter(record => !matchedB.has(record));
  if (sourceA === sourceB && (remainingA.length || remainingB.length)) {
    report.status = 'incomplete';
    report.reason = 'Identical source text produced different parser reports. No change conclusion is available.';
    report.uncertain = [
      ...remainingA.map(record => item('uncertain', record, null, report.reason)),
      ...remainingB.map(record => item('uncertain', null, record, report.reason)),
    ];
    return report;
  }
  const kindsA = new Set(a.records.map(record => record.messageKey));
  const kindsB = new Set(b.records.map(record => record.messageKey));
  // If unmatched diagnostics remain on both sides, a changed parser report can
  // be the same underlying issue. Do not call that a fix plus a new error.
  const unmatchedOnBothSides = remainingA.length > 0 && remainingB.length > 0;
  for (const record of remainingA) {
    const ambiguous = unmatchedOnBothSides || kindsB.has(record.messageKey);
    const category = ambiguous ? 'uncertain' : 'resolved';
    report[category].push(item(category, record, null, ambiguous
      ? 'Changed or repeated diagnostic; a reliable counterpart could not be identified.'
      : 'Reported in A but not in the complete B report. This does not prove the cause was fixed.'));
  }
  for (const record of remainingB) {
    const ambiguous = unmatchedOnBothSides || kindsA.has(record.messageKey);
    const category = ambiguous ? 'uncertain' : 'introduced';
    report[category].push(item(category, null, record, ambiguous
      ? 'Changed or repeated diagnostic; a reliable counterpart could not be identified.'
      : 'Reported in B but not in the complete A report. An earlier issue can hide later parser diagnostics.'));
  }
  if (report.uncertain.length) report.reason = 'Some diagnostics could not be matched reliably; they are shown as uncertain.';
  return report;
}
