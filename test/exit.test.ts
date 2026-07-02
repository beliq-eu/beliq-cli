import { describe, it, expect } from 'vitest'
import { computeExitCode, EXIT } from '../src/exit.js'

describe('computeExitCode', () => {
  it('passes a valid document with no issues', () => {
    expect(computeExitCode({ valid: true, errors: [], warnings: [] }, 'error')).toBe(EXIT.OK)
  })

  it('passes a valid document with warnings under --fail-on error', () => {
    expect(computeExitCode({ valid: true, errors: [], warnings: [{}] }, 'error')).toBe(EXIT.OK)
  })

  it('fails a valid-with-warnings document under --fail-on warning', () => {
    expect(computeExitCode({ valid: true, errors: [], warnings: [{}] }, 'warning')).toBe(EXIT.INVALID)
  })

  it('fails an invalid document under either threshold', () => {
    expect(computeExitCode({ valid: false, errors: [{}], warnings: [] }, 'error')).toBe(EXIT.INVALID)
    expect(computeExitCode({ valid: false, errors: [{}], warnings: [] }, 'warning')).toBe(EXIT.INVALID)
  })

  it('fails when errors are present even if valid is (defensively) true', () => {
    expect(computeExitCode({ valid: true, errors: [{}], warnings: [] }, 'error')).toBe(EXIT.INVALID)
  })
})
