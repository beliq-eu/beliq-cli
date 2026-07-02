import { Beliq, BeliqApiError } from '@beliq/sdk'
import { parseArgs, type ParsedArgs } from './args.js'
import { resolveConfig } from './config.js'
import { EXIT } from './exit.js'
import { IoError, UsageError } from './errors.js'
import type { Deps } from './deps.js'
import type { IO } from './io.js'
import { HELP, version } from './help.js'
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
      const code = err.code ? ` (${err.code})` : ''
      io.stderr(`beliq: API error ${err.status}${code}: ${err.message}`)
      return EXIT.API
    }
    io.stderr(`beliq: unexpected error: ${(err as Error).message}`)
    return 1
  }
}
