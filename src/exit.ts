export const EXIT = {
  /** Success, or a document that passed validation. */
  OK: 0,
  /** A document that failed validation per the chosen --fail-on threshold. */
  INVALID: 1,
  /** A usage problem: bad flag, missing argument, missing API key, PDF without --output. */
  USAGE: 2,
  /** The beliq API returned an error (bad key, quota, engine, a rejected document). */
  API: 3,
  /** A local I/O error: an unreadable input or an output path that already exists. */
  IO: 4,
} as const

export type FailOn = 'error' | 'warning'

interface ValidationLike {
  valid: boolean
  errors?: unknown[]
  warnings?: unknown[]
}

/**
 * The CI contract: EXIT.OK when the document passes the chosen threshold,
 * EXIT.INVALID otherwise. `error` (default) fails on any error; `warning` also
 * fails on any warning.
 */
export function computeExitCode(result: ValidationLike, failOn: FailOn): number {
  const errorCount = result.errors?.length ?? 0
  const warningCount = result.warnings?.length ?? 0
  const failsOnError = !result.valid || errorCount > 0
  if (failOn === 'warning') return failsOnError || warningCount > 0 ? EXIT.INVALID : EXIT.OK
  return failsOnError ? EXIT.INVALID : EXIT.OK
}
