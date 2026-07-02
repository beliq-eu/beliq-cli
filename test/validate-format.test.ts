import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderValidationHuman } from '../src/format/validate.js'
import type { ValidationResult } from '@beliq/sdk'

const here = path.dirname(fileURLToPath(import.meta.url))
function fixture(name: string): ValidationResult {
  return JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8')) as ValidationResult
}

describe('renderValidationHuman', () => {
  it('renders an invalid verdict with format, profile, ruleset, counts, and an issue table', () => {
    const text = renderValidationHuman(fixture('validate-invalid.json'))
    expect(text).toContain('INVALID  cii (profile xrechnung)')
    expect(text).toContain('checked against Schematron 1.3.16')
    expect(text).toContain('1 error, 1 warning')
    // Table header plus a row for the error and the warning.
    expect(text).toContain('SEVERITY')
    expect(text).toMatch(/error\s+BR-DE-15\s+\/rsm:CrossIndustryInvoice\s+The element/)
    // The warning has no location, so it shows a dash.
    expect(text).toMatch(/warning\s+BR-CL-25\s+-\s+Country code/)
  })

  it('renders a valid verdict and still lists warnings', () => {
    const text = renderValidationHuman(fixture('validate-valid.json'))
    expect(text).toContain('VALID  ubl (profile peppol-bis)')
    expect(text).toContain('0 errors, 1 warning')
    expect(text).toContain('PEPPOL-EN16931-R053')
  })

  it('omits the table and the profile/ruleset clauses when there are no issues', () => {
    const result = { valid: true, format: 'ubl', errors: [], warnings: [] } as unknown as ValidationResult
    const text = renderValidationHuman(result)
    expect(text).toBe('VALID  ubl\n0 errors, 0 warnings')
    expect(text).not.toContain('SEVERITY')
  })
})
