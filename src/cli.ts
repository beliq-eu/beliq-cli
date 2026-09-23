import { Beliq, BeliqApiError, type ValidationResult } from '@beliq/sdk'
import { parseArgs, type ParsedArgs } from './args.js'
import { resolveConfig } from './config.js'
import { EXIT } from './exit.js'
import { IoError, UsageError } from './errors.js'
import type { Deps } from './deps.js'
import type { IO } from './io.js'
import { HELP, version } from './help.js'
import { renderValidationHuman } from './format/validate.js'
import { runValidate } from './commands/validate.js'
import { runGenerate } from './commands/generate.js'
import { runParse } from './commands/parse.js'
import { runConvert } from './commands/convert.js'
import { runMe } from './commands/me.js'

type Command = (args: ParsedArgs, deps: Deps, io: IO) => Promise<number>

const COMMANDS: Record<string, Command> = {
  validate: runValidate,
  generate: runGenerate,
  parse: runParse,
  convert: runConvert,
  me: runMe,
}

async function dispatch(args: ParsedArgs, io: IO, env: NodeJS.ProcessEnv): Promise<number> {
  const command = args.command ? COMMANDS[args.command] : undefined
  if (!command) throw new UsageError(`unknown command "${args.command}". Run beliq --help.`)

  const config = resolveConfig(args, env)
  const client = new Beliq({ apiKey: config.apiKey, baseUrl: config.baseUrl, auth: config.auth })
  return command(args, { client }, io)
}

/**
 * The CLI entry: parse argv, handle --help / --version, dispatch to a command,
 * and map every error class to its exit code (see EXIT). Pure in its IO + env
 * seams so it can be driven from a test without touching real streams. Returns
 * the process exit code.
 */
export async function main(argv: string[], io: IO, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let args: ParsedArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(`beliq: ${err.message}`)
      return EXIT.USAGE
    }
    throw err
  }

  if (args.help || (!args.command && !args.version)) {
    io.stdout(HELP)
    return EXIT.OK
  }
  if (args.version) {
    io.stdout(`${version()}\n`)
    return EXIT.OK
  }

  try {
    return await dispatch(args, io, env)
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(`beliq: ${err.message}`)
      return EXIT.USAGE
    }
    if (err instanceof IoError) {
      io.stderr(`beliq: ${err.message}`)
      return EXIT.IO
    }
    if (err instanceof BeliqApiError) {
      reportApiError(err, args, io)
      return EXIT.API
    }
    // Mostly a transport failure (DNS, a refused connection, TLS), which the SDK
    // rethrows as fetch's own TypeError. None of these is a verdict on the
    // document, and exit 1 is the "document invalid" code a CI gate reads.
    io.stderr(`beliq: unexpected error: ${describeError(err)}`)
    return EXIT.API
  }
}

/**
 * An API error on stderr, followed by the rules a rejected document failed when
 * the API names them (a 422 from generate carries its validation result in
 * `details`). With --json the error object goes to stdout as well, so a script
 * reading stdout gets a payload on failure too.
 */
function reportApiError(err: BeliqApiError, args: ParsedArgs, io: IO): void {
  const code = err.code ? ` (${err.code})` : ''
  io.stderr(`beliq: API error ${err.status}${code}: ${err.message}`)

  const result = err.details?.validationResult as ValidationResult | undefined
  if (result && typeof result === 'object') io.stderr(renderValidationHuman(result))

  if (args.flags.json === true) {
    const error = { status: err.status, code: err.code, message: err.message, details: err.details }
    io.stdout(`${JSON.stringify({ error }, null, 2)}\n`)
  }
}

/** The message plus its cause: fetch reports only "fetch failed" and keeps the reason in `cause`. */
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined
  return cause ? `${message} (${cause})` : message
}
