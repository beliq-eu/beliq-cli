import type { ValidationResult } from '@beliq/sdk'

interface Issue {
  ruleId: string
  severity: string
  location?: string
  message: string
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/**
 * Render an aligned table. Every column except the last (message) is padded to
 * its widest cell; the message is left unpadded so a long message never forces
 * truncation or breaks alignment.
 */
function renderTable(headers: string[], rows: string[][]): string {
  const last = headers.length - 1
  const widths = headers.map((h, col) =>
    col === last ? 0 : Math.max(h.length, ...rows.map((r) => r[col].length)),
  )
  const line = (cells: string[]): string =>
    cells.map((cell, col) => (col === last ? cell : cell.padEnd(widths[col]))).join('  ')
  return [line(headers), ...rows.map(line)].join('\n')
}

/**
 * A human-readable verdict: the pass/fail line with format, profile, and
 * ruleset version, the issue counts, and an aligned table of the errors then
 * warnings. `--json` emits the raw result instead.
 */
export function renderValidationHuman(result: ValidationResult): string {
  const errors = (result.errors ?? []) as Issue[]
  const warnings = (result.warnings ?? []) as Issue[]

  const verdict = result.valid ? 'VALID' : 'INVALID'
  const profile = result.profileDetected ? ` (profile ${result.profileDetected})` : ''
  const schematron = result.schematronVersion ? `  checked against Schematron ${result.schematronVersion}` : ''
  const head = `${verdict}  ${result.format}${profile}${schematron}`
  const counts = `${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}`

  const issues = [...errors, ...warnings]
  if (issues.length === 0) return `${head}\n${counts}`

  const rows = issues.map((i) => [i.severity, i.ruleId, i.location || '-', i.message])
  return `${head}\n${counts}\n\n${renderTable(['SEVERITY', 'RULE', 'LOCATION', 'MESSAGE'], rows)}`
}

/**
 * One row of a batch validation: either a validated document (with its result
 * and whether it fails the chosen --fail-on threshold) or a file that could not
 * be checked (unreadable, or the API errored on it).
 */
export type BatchRow =
  | { file: string; result: ValidationResult; fails: boolean }
  | { file: string; error: string }

/**
 * A batch verdict: a per-file table (PASS / FAIL / ERROR with error and warning
 * counts) and a one-line summary. The exit code, not this text, is the CI
 * contract; this is the human view.
 */
export function renderBatchHuman(rows: BatchRow[]): string {
  const cells = rows.map((r) =>
    'error' in r
      ? ['ERROR', '-', '-', `${r.file}  (${r.error})`]
      : [
          r.fails ? 'FAIL' : 'PASS',
          String((r.result.errors ?? []).length),
          String((r.result.warnings ?? []).length),
          r.file,
        ],
  )
  const table = renderTable(['STATUS', 'ERR', 'WARN', 'FILE'], cells)

  const passed = rows.filter((r) => 'result' in r && !r.fails).length
  const failed = rows.filter((r) => 'result' in r && r.fails).length
  const errored = rows.filter((r) => 'error' in r).length
  const summary = `${plural(rows.length, 'file')}: ${passed} passed, ${failed} failed, ${errored} errored`

  return `${table}\n\n${summary}`
}
