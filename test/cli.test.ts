import { describe, it, expect } from 'vitest'
import { main } from '../src/cli.js'
import { recordingIO } from './helpers.js'

// main() builds a real client only after config resolves, so every path here is
// network-free: help/version, an unknown command, a parse error, and a missing
// key all return before any API call. An empty env guarantees no ambient key.
const NO_ENV = {} as NodeJS.ProcessEnv

describe('main (network-free paths)', () => {
  it('prints help for --help and returns 0', async () => {
    const { io, out } = recordingIO()
    const code = await main(['--help'], io, NO_ENV)
    expect(code).toBe(0)
    expect(out()).toContain('Usage:')
  })

  it('prints help when given no command', async () => {
    const { io, out } = recordingIO()
    const code = await main([], io, NO_ENV)
    expect(code).toBe(0)
    expect(out()).toContain('Usage:')
  })

  it('prints a version for --version', async () => {
    const { io, out } = recordingIO()
    const code = await main(['--version'], io, NO_ENV)
    expect(code).toBe(0)
    expect(out().trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('returns a usage error (2) for an unknown command', async () => {
    const { io, err } = recordingIO()
    const code = await main(['bogus'], io, NO_ENV)
    expect(code).toBe(2)
    expect(err()).toContain('unknown command')
  })

  it('returns a usage error (2) when no API key is available', async () => {
    const { io, err } = recordingIO()
    const code = await main(['validate', 'x.xml'], io, NO_ENV)
    expect(code).toBe(2)
    expect(err()).toContain('no API key')
  })

  it('returns a usage error (2) for an unknown option', async () => {
    const { io, err } = recordingIO()
    const code = await main(['validate', 'x.xml', '--nope'], io, NO_ENV)
    expect(code).toBe(2)
    expect(err()).toContain('unknown option')
  })
})
