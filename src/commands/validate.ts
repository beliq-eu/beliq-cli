import { LIVE_VALIDATE_FORMATS, BeliqApiError, type ValidateFormat, type ValidationResult } from '@beliq/sdk'
import { flagBool, flagStr, oneOf, type ParsedArgs } from '../args.js'
import { EXIT, computeExitCode, type FailOn } from '../exit.js'
import { UsageError } from '../errors.js'
import { renderValidationHuman, renderBatchHuman, type BatchRow } from '../format/validate.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'

const FAIL_ON = ['error', 'warning'] as const

// API statuses that mean the whole batch is doomed (bad key, forbidden, or
// rate-limited), not one bad document. Fail fast rather than retry per file.
const FATAL_API_STATUSES = new Set([401, 403, 429])

interface BatchOptions {
  format: ValidateFormat | undefined
  contentType: string | undefined
  franceCtc: true | undefined
  failOn: FailOn
  json: boolean
}

/**
 * Validate one or many documents against beliq's authority-pinned rules.
 *
 * One file (or `-`) named on its own keeps the classic per-document output.
 * Multiple inputs, or a directory (its `.xml`/`.pdf` files, recursively), switch
 * to a batch: a per-file verdict, an aggregate summary, and a batch exit code (0
 * all pass, 1 some document fails --fail-on, 3 some file could not be checked).
 * A directory stays a batch even when it holds one invoice, so the --json shape
 * follows what was asked for rather than how many files were found.
 */
export async function runValidate(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const format = oneOf(flagStr(args, 'format'), LIVE_VALIDATE_FORMATS, 'format') as ValidateFormat | undefined
  const failOn = (oneOf(flagStr(args, 'fail-on'), FAIL_ON, 'fail-on') ?? 'error') as FailOn
  const contentType = flagStr(args, 'content-type')
  // Sent only when set: the API's own default decides otherwise.
  const franceCtc = flagBool(args, 'france-ctc') ? true : undefined
  const json = flagBool(args, 'json')

  if (args.positionals.length === 0) {
    throw new UsageError('missing file argument. Usage: beliq validate <file|dir|-> [<file|dir> ...]')
  }

  const files = await io.expandInputs(args.positionals)
  if (files.length === 0) {
    throw new UsageError(`no .xml or .pdf files found in: ${args.positionals.join(', ')}`)
  }
  if (files.length > 1 && files.includes('-')) {
    throw new UsageError('cannot mix "-" (stdin) with other inputs')
  }

  // expandInputs returns a named file as given and a directory as the files
  // inside it, so a single input that comes back unchanged was a file.
  const single = args.positionals.length === 1 && files.length === 1 && files[0] === args.positionals[0]
  if (single) {
    const result = await deps.client.validate(await io.readInput(files[0]), { format, contentType, franceCtc })
    io.stdout(json ? `${JSON.stringify(result, null, 2)}\n` : `${renderValidationHuman(result)}\n`)
    return computeExitCode(result, failOn)
  }

  return runBatch(files, { format, contentType, franceCtc, failOn, json }, deps, io)
}

async function runBatch(files: string[], opts: BatchOptions, deps: Deps, io: IO): Promise<number> {
  const rows: BatchRow[] = []

  for (const file of files) {
    try {
      const bytes = await io.readInput(file)
      const result = await deps.client.validate(bytes, {
        format: opts.format,
        contentType: opts.contentType,
        franceCtc: opts.franceCtc,
      })
      rows.push({ file, result, fails: computeExitCode(result, opts.failOn) !== EXIT.OK })
    } catch (err) {
      if (err instanceof BeliqApiError && FATAL_API_STATUSES.has(err.status)) throw err
      rows.push({ file, error: errorMessage(err) })
    }
  }

  io.stdout(opts.json ? `${JSON.stringify(batchReport(rows), null, 2)}\n` : `${renderBatchHuman(rows)}\n`)

  if (rows.some((r) => 'error' in r)) return EXIT.API
  if (rows.some((r) => 'result' in r && r.fails)) return EXIT.INVALID
  return EXIT.OK
}

function errorMessage(err: unknown): string {
  if (err instanceof BeliqApiError) {
    const code = err.code ? ` (${err.code})` : ''
    return `API error ${err.status}${code}: ${err.message}`
  }
  return (err as Error).message
}

function batchReport(rows: BatchRow[]): unknown {
  const results = rows.map((r) =>
    'error' in r
      ? { file: r.file, status: 'error', message: r.error }
      : { file: r.file, status: r.fails ? 'fail' : 'pass', ...(r.result as ValidationResult) },
  )
  return {
    total: rows.length,
    passed: rows.filter((r) => 'result' in r && !r.fails).length,
    failed: rows.filter((r) => 'result' in r && r.fails).length,
    errored: rows.filter((r) => 'error' in r).length,
    results,
  }
}
