import type { ValidationResult } from '@beliq/sdk'
import {
  checkDepth,
  franceBlockLines,
  franceBlockingRuleIds,
  pdfInputLine,
  rulesetChannelLine,
  verdictWord,
} from '../verdict.js'

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
 * A human-readable verdict: the API's verdict word with the format, the
 * profile, the check depth and the ruleset version, then the issue counts, what
 * the API says about the ruleset channel, a PDF input and a France CTC block,
 * and an aligned table of the errors then warnings. `--json` emits the raw
 * result instead.
 */
export function renderValidationHuman(result: ValidationResult): string {
  const errors = (result.errors ?? []) as Issue[]
  const warnings = (result.warnings ?? []) as Issue[]

  const profile = result.profileDetected ? ` (profile ${result.profileDetected})` : ''
  // Nothing ran when `verified` is false, so there is no depth and no ruleset to name.
  const ran = result.verified !== false
  const depth = ran ? `  ${checkDepth(result)}` : ''
  const schematron =
    ran && result.schematronVersion ? `  checked against Schematron ${result.schematronVersion}` : ''
  const head = `${verdictWord(result)}  ${result.format}${profile}${depth}${schematron}`
  const counts = `${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}`

  const france = franceBlockLines(result)
  const notes = [
    rulesetChannelLine(result),
    pdfInputLine(result),
    ...france,
    ...(france.length > 0 ? ['This file is reported as failed (exit 1) under every --fail-on.'] : []),
  ].filter((line): line is string => line !== undefined)
  const top = [head, counts, ...notes].join('\n')

  const issues = [...errors, ...warnings]
  if (issues.length === 0) return top

  const rows = issues.map((i) => [i.severity, i.ruleId, i.location || '-', i.message])
  return `${top}\n\n${renderTable(['SEVERITY', 'RULE', 'LOCATION', 'MESSAGE'], rows)}`
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
 * counts and the check depth), a line for each file a France CTC block fails,
 * and a one-line summary. The exit code, not this text, is the CI contract;
 * this is the human view.
 */
export function renderBatchHuman(rows: BatchRow[]): string {
  const cells = rows.map((r) =>
    'error' in r
      ? ['ERROR', '-', '-', '-', `${r.file}  (${r.error})`]
      : [
          r.fails ? 'FAIL' : 'PASS',
          String((r.result.errors ?? []).length),
          String((r.result.warnings ?? []).length),
          checkDepth(r.result),
          r.file,
        ],
  )
  const table = renderTable(['STATUS', 'ERR', 'WARN', 'DEPTH', 'FILE'], cells)
  const blocked = rows.flatMap((r) => {
    if ('error' in r) return []
    const ids = franceBlockingRuleIds(r.result)
    return ids.length > 0 ? [`${r.file}: France CTC blocking rule ids: ${ids.join(', ')}`] : []
  })

  const passed = rows.filter((r) => 'result' in r && !r.fails).length
  const failed = rows.filter((r) => 'result' in r && r.fails).length
  const errored = rows.filter((r) => 'error' in r).length
  const summary = `${plural(rows.length, 'file')}: ${passed} passed, ${failed} failed, ${errored} errored`

  return [table, ...(blocked.length > 0 ? [blocked.join('\n')] : []), summary].join('\n\n')
}
