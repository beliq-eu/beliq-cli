import { describe, it, expect } from 'vitest'
import { flagBool, flagStr, oneOf, parseArgs } from '../src/args.js'
import { UsageError } from '../src/errors.js'

describe('parseArgs', () => {
  it('reads a command, positional, and a value flag (space form)', () => {
    const args = parseArgs(['validate', 'invoice.xml', '--format', 'cii'])
    expect(args.command).toBe('validate')
    expect(args.positionals).toEqual(['invoice.xml'])
    expect(args.flags.format).toBe('cii')
  })

  it('reads a value flag in --flag=value form', () => {
    const args = parseArgs(['validate', 'x.xml', '--fail-on=warning'])
    expect(args.flags['fail-on']).toBe('warning')
  })

  it('reads boolean flags without a value', () => {
    const args = parseArgs(['generate', 'i.json', '--pdf', '--no-verify', '--json'])
    expect(args.flags.pdf).toBe(true)
    expect(args.flags['no-verify']).toBe(true)
    expect(args.flags.json).toBe(true)
  })

  it('treats a lone dash as a positional (stdin)', () => {
    const args = parseArgs(['validate', '-'])
    expect(args.positionals).toEqual(['-'])
  })

  it('collects -h / --help and -v / --version', () => {
    expect(parseArgs(['-h']).help).toBe(true)
    expect(parseArgs(['validate', '--help']).help).toBe(true)
    expect(parseArgs(['-v']).version).toBe(true)
  })

  it('keeps later non-flag tokens as extra positionals', () => {
    const args = parseArgs(['convert', 'a.xml', 'b.xml'])
    expect(args.positionals).toEqual(['a.xml', 'b.xml'])
  })

  it('rejects an unknown option', () => {
    expect(() => parseArgs(['validate', 'x.xml', '--bogus'])).toThrow(UsageError)
  })

  it('rejects an unknown short option', () => {
    expect(() => parseArgs(['validate', '-x'])).toThrow(UsageError)
  })

  it('rejects a value flag with no value', () => {
    expect(() => parseArgs(['validate', 'x.xml', '--format'])).toThrow(UsageError)
  })

  it('rejects a value given to a boolean flag', () => {
    expect(() => parseArgs(['validate', 'x.xml', '--json=true'])).toThrow(UsageError)
  })
})

describe('flag accessors', () => {
  it('flagBool is true only for a set boolean flag', () => {
    const args = parseArgs(['me', '--json'])
    expect(flagBool(args, 'json')).toBe(true)
    expect(flagBool(args, 'pdf')).toBe(false)
  })

  it('flagStr returns a string value or undefined', () => {
    const args = parseArgs(['validate', 'x.xml', '--format', 'ubl'])
    expect(flagStr(args, 'format')).toBe('ubl')
    expect(flagStr(args, 'fail-on')).toBeUndefined()
  })
})

describe('oneOf', () => {
  const allowed = ['auto', 'cii', 'ubl'] as const

  it('returns an allowed value', () => {
    expect(oneOf('cii', allowed, 'format')).toBe('cii')
  })

  it('returns the fallback when the value is absent', () => {
    expect(oneOf(undefined, allowed, 'format', 'auto')).toBe('auto')
    expect(oneOf(undefined, allowed, 'format')).toBeUndefined()
  })

  it('throws a UsageError for a value not in the allow-list', () => {
    expect(() => oneOf('docx', allowed, 'format')).toThrow(UsageError)
  })
})
