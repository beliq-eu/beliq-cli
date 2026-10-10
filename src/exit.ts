export const EXIT = {
  /** Success, or a document that passed validation. */
  OK: 0,
  /**
   * A document that failed validation per the chosen --fail-on threshold, or one
   * whose result carries France CTC blocking rule ids.
   */
  INVALID: 1,
  /** A usage problem: bad flag, missing argument, missing API key, PDF without --output. */
  USAGE: 2,
  /**
   * The beliq API returned an error (bad key, quota, engine, a rejected
   * document), could not be reached, or something unexpected failed. Never a
   * verdict on the document.
   */
  API: 3,
  /** A local I/O error: an unreadable input or an output path that already exists. */
  IO: 4,
} as const

export type FailOn = 'error' | 'warning'

interface ValidationLike {
  valid: boolean
  errors?: unknown[]
  warnings?: unknown[]
  franceCtcBlockingRuleIds?: string[]
}

/**
 * The CI contract: EXIT.OK when the document passes the chosen threshold,
 * EXIT.INVALID otherwise. `error` (default) fails on any error; `warning` also
 * fails on any warning. A result that carries France CTC blocking rule ids
 * fails under both: the API reports those ids beside `valid`, also where `valid`
 * is true, so the default threshold alone would let such a result pass.
 */
export function computeExitCode(result: ValidationLike, failOn: FailOn): number {
  const errorCount = result.errors?.length ?? 0
  const warningCount = result.warnings?.length ?? 0
  if ((result.franceCtcBlockingRuleIds?.length ?? 0) > 0) return EXIT.INVALID
  const failsOnError = !result.valid || errorCount > 0
  if (failOn === 'warning') return failsOnError || warningCount > 0 ? EXIT.INVALID : EXIT.OK
  return failsOnError ? EXIT.INVALID : EXIT.OK
}
