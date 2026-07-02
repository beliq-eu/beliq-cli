import { LIVE_VALIDATE_FORMATS, type ValidateFormat } from '@beliq/sdk'
import { flagBool, flagStr, oneOf, requirePositional, type ParsedArgs } from '../args.js'
import { computeExitCode, type FailOn } from '../exit.js'
import { renderValidationHuman } from '../format/validate.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'

const FAIL_ON = ['error', 'warning'] as const

/**
 * Validate one document against beliq's authority-pinned rules. Prints the
 * verdict (human table or, with --json, the raw ValidationResult) and returns
 * the CI exit code: 0 if it passes the --fail-on threshold, 1 if it fails.
 */
export async function runValidate(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const file = requirePositional(args, 'beliq validate <file|->')
  const format = oneOf(flagStr(args, 'format'), LIVE_VALIDATE_FORMATS, 'format')
  const failOn = (oneOf(flagStr(args, 'fail-on'), FAIL_ON, 'fail-on') ?? 'error') as FailOn

  const bytes = await io.readInput(file)
  const result = await deps.client.validate(bytes, {
    format: format as ValidateFormat | undefined,
    contentType: flagStr(args, 'content-type'),
  })

  if (flagBool(args, 'json')) io.stdout(`${JSON.stringify(result, null, 2)}\n`)
  else io.stdout(`${renderValidationHuman(result)}\n`)

  return computeExitCode(result, failOn)
}
