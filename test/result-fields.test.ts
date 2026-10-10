import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { ValidationResult } from '@beliq/sdk'
import { renderValidationHuman } from '../src/format/validate.js'
import { VALIDATION_FIELDS } from '../src/resultFields.js'

// The typecheck holds the map to the SDK's type. This holds the map to the
// renderer: a field marked `text` has to change the human output of a recorded
// answer that carries it, and a field marked `json` must not.

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const recorded = readdirSync(dir)
  .filter((name) => name.startsWith('live-validate-'))
  .map((name) => ({ name, result: JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as ValidationResult }))

const pdf: ValidationResult = {
  ...recorded[0].result,
  verified: true,
  pdfInput: { containerChecked: false, attachmentFoundBy: 'embedded-file', attachmentCandidates: 1 },
}
const fellBack: ValidationResult = { ...recorded[0].result, rulesetChannel: 'previous', rulesetFellBack: true }
const subjects = [...recorded, { name: 'pdf', result: pdf }, { name: 'fell-back', result: fellBack }]

/** A value of the same type that differs from the one given. */
function changed(value: unknown): unknown {
  if (typeof value === 'boolean') return !value
  if (typeof value === 'string') return `${value}-changed`
  if (Array.isArray(value)) {
    const extra = typeof value[0] === 'string' ? 'BR-X' : { ruleId: 'X', severity: 'error', message: 'm' }
    return [...value, extra]
  }
  return undefined
}

describe('the validation field map', () => {
  const fields = Object.entries(VALIDATION_FIELDS) as [keyof ValidationResult, 'text' | 'json'][]

  it('is exercised by the recorded answers for every text field', () => {
    for (const [field, handling] of fields) {
      if (handling !== 'text') continue
      expect(subjects.some((s) => s.result[field] !== undefined), `no subject carries ${field}`).toBe(true)
    }
  })

  it.each(fields.filter(([, h]) => h === 'text'))('%s changes the human output', (field) => {
    for (const { name, result } of subjects) {
      if (result[field] === undefined) continue
      const other = { ...result, [field]: changed(result[field]) } as ValidationResult
      expect(renderValidationHuman(other), `${field} in ${name}`).not.toBe(renderValidationHuman(result))
    }
  })

  it.each(fields.filter(([, h]) => h === 'json'))('%s leaves the human output alone', (field) => {
    for (const { name, result } of subjects) {
      if (result[field] === undefined) continue
      const other = { ...result, [field]: changed(result[field]) } as ValidationResult
      expect(renderValidationHuman(other), `${field} in ${name}`).toBe(renderValidationHuman(result))
    }
  })
})
