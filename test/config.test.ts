import { describe, it, expect } from 'vitest'
import { parseArgs } from '../src/args.js'
import { resolveConfig } from '../src/config.js'
import { UsageError } from '../src/errors.js'

const KEY = { BELIQ_API_KEY: 'blq_test_x' } as NodeJS.ProcessEnv

describe('resolveConfig auth mode', () => {
  it('defaults to header', () => {
    expect(resolveConfig(parseArgs(['me']), KEY).auth).toBe('header')
  })

  it('reads bearer from the flag or the environment, in any case', () => {
    expect(resolveConfig(parseArgs(['me', '--auth', 'bearer']), KEY).auth).toBe('bearer')
    expect(resolveConfig(parseArgs(['me']), { ...KEY, BELIQ_AUTH: ' Bearer ' }).auth).toBe('bearer')
  })

  it('refuses an unknown mode instead of falling back to header', () => {
    expect(() => resolveConfig(parseArgs(['me', '--auth', 'baerer']), KEY)).toThrow(UsageError)
    expect(() => resolveConfig(parseArgs(['me']), { ...KEY, BELIQ_AUTH: 'token' })).toThrow(
      '--auth (or BELIQ_AUTH) must be one of: header, bearer',
    )
  })
})
