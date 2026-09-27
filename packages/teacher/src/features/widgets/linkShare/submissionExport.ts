export interface ExportableSubmission {
  studentName?: string;
  content?: string;
  isLink: boolean;
  /** Legacy field: older submissions stored the URL here instead of `content`. */
  link?: string;
  timestamp?: number;
}

const CSV_HEADER = ['Name', 'Content', 'Type', 'Submitted at'];
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const pad = (value: number) => String(value).padStart(2, '0');

const nameOf = (submission: ExportableSubmission) => submission.studentName || 'Anonymous';
const contentOf = (submission: ExportableSubmission) => submission.content || submission.link || '';

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatLocalDateTime(timestamp: number | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatLocalDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Escapes one CSV field (RFC 4180). Student-typed values that start with a
 * spreadsheet formula character are prefixed with an apostrophe so Excel or
 * Sheets shows them as text instead of evaluating them.
 */
function escapeCsvField(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function formatSubmissionsAsCsv(submissions: ExportableSubmission[]): string {
  const rows = submissions.map((submission) => [
    nameOf(submission),
    contentOf(submission),
    submission.isLink ? 'Link' : 'Text',
    formatLocalDateTime(submission.timestamp)
  ]);
  return [CSV_HEADER, ...rows]
    .map((row) => row.map(escapeCsvField).join(',') + '\r\n')
    .join('');
}

/** One "Name: content" line per submission; line breaks inside a submission become spaces. */
export function formatSubmissionsAsText(submissions: ExportableSubmission[]): string {
  return submissions
    .map((submission) => `${nameOf(submission)}: ${contentOf(submission).replace(/[\r\n]+/g, ' ')}`)
    .join('\n');
}

export function getSubmissionsCsvFilename(date: Date = new Date()): string {
  return `drop-box-${formatLocalDate(date)}.csv`;
}
