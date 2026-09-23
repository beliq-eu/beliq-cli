import { DEFAULT_BASE_URL } from '@beliq/sdk'
import { flagStr, oneOf, type ParsedArgs } from './args.js'
import { UsageError } from './errors.js'

const AUTH_MODES = ['header', 'bearer'] as const

export interface Config {
  apiKey: string
  baseUrl: string
  /** How the key is sent to beliq: X-API-Key (default) or Authorization: Bearer. */
  auth: 'header' | 'bearer'
}

/**
 * Resolve the typed config with precedence flag > env > default. Throws a
 * UsageError if no API key is available so the CLI reports a clean usage error
 * rather than failing mid-request. The SDK reads no environment itself, so the
 * CLI owns this.
 */
export function resolveConfig(args: ParsedArgs, env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = (flagStr(args, 'api-key') ?? env.BELIQ_API_KEY)?.trim()
  if (!apiKey) {
    throw new UsageError(
      'no API key. Set BELIQ_API_KEY or pass --api-key. Create a key in the beliq dashboard under API Keys.',
    )
  }

  const baseUrl = (flagStr(args, 'base-url') ?? env.BELIQ_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  // An unknown mode is refused rather than read as `header`: a typo in
  // `bearer` would otherwise send the key a way the caller did not ask for.
  const authRaw = (flagStr(args, 'auth') ?? env.BELIQ_AUTH ?? '').trim().toLowerCase()
  const auth = oneOf(authRaw || undefined, AUTH_MODES, 'auth (or BELIQ_AUTH)', 'header') as Config['auth']

  return { apiKey, baseUrl, auth }
}
