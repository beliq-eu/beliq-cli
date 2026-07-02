import { UsageError } from './errors.js'

export interface ParsedArgs {
  command?: string
  positionals: string[]
  flags: Record<string, string | boolean>
  help: boolean
  version: boolean
}

/** Flags that take no value. */
const BOOLEAN_FLAGS = new Set(['json', 'pdf', 'no-verify', 'france-ctc'])

/** Flags that take a value (`--flag value` or `--flag=value`). */
const VALUE_FLAGS = new Set([
  'format',
  'target-format',
  'source-format',
  'target-profile',
  'facturx-profile',
  'content-type',
  'fail-on',
  'standard',
  'api-key',
  'base-url',
  'auth',
  'output',
])

/**
 * Parse argv into a command, its positionals, and flags. Hand-rolled (no
 * dependency): the surface is small and this stays pure and unit-testable. The
 * first non-flag token is the command; a `-` positional means stdin. Unknown
 * flags and unknown short options are usage errors.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { positionals: [], flags: {}, help: false, version: false }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (token === '--help' || token === '-h') {
      out.help = true
      continue
    }
    if (token === '--version' || token === '-v') {
      out.version = true
      continue
    }

    if (token.startsWith('--')) {
      const body = token.slice(2)
      const eq = body.indexOf('=')
      const name = eq >= 0 ? body.slice(0, eq) : body
      const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined

      if (BOOLEAN_FLAGS.has(name)) {
        if (inlineValue !== undefined) throw new UsageError(`option --${name} takes no value`)
        out.flags[name] = true
      } else if (VALUE_FLAGS.has(name)) {
        let value = inlineValue
        if (value === undefined) {
          value = argv[++i]
          if (value === undefined) throw new UsageError(`option --${name} needs a value`)
        }
        out.flags[name] = value
      } else {
        throw new UsageError(`unknown option --${name}`)
      }
      continue
    }

    // A lone "-" is the stdin positional; any other "-x" is an unknown short option.
    if (token.startsWith('-') && token.length > 1) {
      throw new UsageError(`unknown option ${token}`)
    }

    if (out.command === undefined) out.command = token
    else out.positionals.push(token)
  }

  return out
}

export function flagBool(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true
}

export function flagStr(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name]
  return typeof value === 'string' ? value : undefined
}

export function requirePositional(args: ParsedArgs, usage: string): string {
  const value = args.positionals[0]
  if (value === undefined) throw new UsageError(`missing file argument. Usage: ${usage}`)
  return value
}

/**
 * Validate a flag value against an allow-list. Returns the value (typed to the
 * allowed union), the fallback when the flag is absent, or throws a UsageError
 * when the value is not allowed.
 */
export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  flagName: string,
  fallback?: T,
): T | undefined {
  if (value === undefined) return fallback
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`--${flagName} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}
