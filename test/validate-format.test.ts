import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderBatchHuman, renderValidationHuman } from '../src/format/validate.js'
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
    expect(text).toBe('VALID  ubl  check depth not stated\n0 errors, 0 warnings')
    expect(text).not.toContain('SEVERITY')
  })

  // The live-validate-* fixtures are answers of the live API, recorded on
  // 2026-10-11 at document version 0.15.0 and stored as they came.

  it('prints the badge label the API sent beside the verdict', () => {
    expect(renderValidationHuman(fixture('live-validate-authority.json')).split('\n')[0]).toBe(
      'VALID  ubl (profile xrechnung)  Authority-checked  checked against Schematron 1.3.16',
    )
    expect(renderValidationHuman(fixture('live-validate-schema.json')).split('\n')[0]).toBe(
      'VALID  fatturapa (profile italy-fatturapa-ordinaria-fpr12)  Schema-checked',
    )
  })

  it('is what the README shows as its sample verdict', () => {
    const readme = readFileSync(path.join(here, '..', 'README.md'), 'utf8')
    expect(readme).toContain(
      `$ beliq validate invoice.xml\n${renderValidationHuman(fixture('live-validate-schema.json'))}\n\`\`\``,
    )
  })

  it('marks a verdict the API sent no badge for, and names no depth', () => {
    const result = fixture('live-validate-nobadge.json')
    expect(result.verificationBadgeLabel).toBeUndefined()
    expect(renderValidationHuman(result)).toBe(
      'VALID  fatturapa (profile italy-fatturapa-pa-fpa12)  check depth not stated\n0 errors, 0 warnings',
    )
  })

  it('puts the API message and the rule ids of a France CTC block under a VALID verdict', () => {
    const result = fixture('live-validate-france-previous.json')
    expect(result.valid).toBe(true)
    const lines = renderValidationHuman(result).split('\n')
    expect(lines[0]).toBe('VALID  cii  Authority-checked  checked against Schematron 1.3.16')
    expect(lines[2]).toBe('Ruleset channel: previous; the retained ruleset is served until 2027-05-16')
    expect(lines[3]).toBe(result.warnings.find((w) => w.ruleId === 'FRANCE_CTC_FINDINGS_BLOCK_TRANSMISSION')?.message)
    for (const id of result.franceCtcBlockingRuleIds ?? []) expect(lines[3]).toContain(id)
    // The message names every id, so the id line is not repeated under it.
    expect(lines[4]).toBe('')
    expect(renderValidationHuman(result, { franceFailsFile: true }).split('\n')[4]).toBe(
      'This file is reported as failed (exit 1) under every --fail-on.',
    )
  })

  it('prints the rule ids when the API message for them is missing or leaves one out', () => {
    const result = fixture('live-validate-france-previous.json')
    const without = { ...result, warnings: result.warnings.filter((w) => w.ruleId !== 'FRANCE_CTC_FINDINGS_BLOCK_TRANSMISSION') }
    expect(renderValidationHuman(without)).toContain(
      `France CTC blocking rule ids: ${result.franceCtcBlockingRuleIds?.join(', ')}`,
    )
    const extra = { ...result, franceCtcBlockingRuleIds: [...(result.franceCtcBlockingRuleIds ?? []), 'BR-FR-99'] }
    expect(renderValidationHuman(extra)).toContain('France CTC blocking rule ids: BR-FR-05_BT-22_AAB')
  })

  it('replaces control characters in the name of the embedded file', () => {
    const result = {
      ...fixture('live-validate-schema.json'),
      pdfInput: {
        containerChecked: false,
        attachmentName: `x"${String.fromCharCode(10)}INVALID${String.fromCharCode(27)}[2K`,
        attachmentFoundBy: 'xml-content',
        attachmentCandidates: 1,
      },
    } as ValidationResult
    const text = renderValidationHuman(result)
    expect(text.split('\n')).toHaveLength(3)
    expect(text).toContain('the embedded XML "x"?INVALID?[2K"')
  })

  it('prints no France lines for a result without the field', () => {
    expect(renderValidationHuman(fixture('live-validate-authority.json'))).not.toContain('France CTC')
  })

  it('says which embedded file a PDF verdict is about and that the PDF was not checked', () => {
    const result = {
      ...fixture('live-validate-authority.json'),
      pdfInput: {
        containerChecked: false,
        attachmentName: 'factur-x.xml',
        attachmentFoundBy: 'associated-file',
        attachmentCandidates: 1,
      },
    } as ValidationResult
    expect(renderValidationHuman(result)).toContain(
      'PDF input: the verdict is about the embedded XML "factur-x.xml" (found by associated-file). The PDF itself was not checked.',
    )
    const two = { ...result, pdfInput: { ...result.pdfInput!, attachmentCandidates: 2 } } as ValidationResult
    expect(renderValidationHuman(two)).toContain(
      'The PDF itself was not checked. 2 embedded files could be taken for the invoice, and nothing compared them.',
    )
  })

  it('names neither a depth nor a ruleset for a result nothing validated', () => {
    const result = { valid: false, verified: false, format: 'cii', schematronVersion: '1.3.16', errors: [], warnings: [] }
    expect(renderValidationHuman(result as unknown as ValidationResult)).toBe('NOT VALIDATED  cii\n0 errors, 0 warnings')
  })
})

describe('renderBatchHuman', () => {
  it('shows each file\'s check depth and names the files a France CTC block fails', () => {
    const france = fixture('live-validate-france-previous.json')
    const text = renderBatchHuman([
      { file: 'a.xml', result: fixture('live-validate-authority.json'), fails: false },
      { file: 'b.xml', result: fixture('live-validate-nobadge.json'), fails: false },
      { file: 'fr.xml', result: france, fails: true },
      { file: 'gone.xml', error: 'could not read' },
    ])
    expect(text).toMatch(/^STATUS\s+ERR\s+WARN\s+DEPTH\s+FILE$/m)
    expect(text).toMatch(/^PASS\s+0\s+1\s+Authority-checked\s+a\.xml$/m)
    expect(text).toMatch(/^PASS\s+0\s+0\s+check depth not stated\s+b\.xml$/m)
    expect(text).toMatch(/^FAIL\s+0\s+10\s+Authority-checked\s+fr\.xml$/m)
    expect(text).toMatch(/^ERROR\s+-\s+-\s+-\s+gone\.xml {2}\(could not read\)$/m)
    expect(text).toContain(`fr.xml: France CTC blocking rule ids: ${france.franceCtcBlockingRuleIds?.join(', ')}`)
    expect(text).toContain('4 files: 2 passed, 1 failed, 1 errored')
  })
})
