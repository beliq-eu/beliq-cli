import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Beliq } from '@beliq/sdk'
import { parseArgs } from '../src/args.js'
import { runValidate } from '../src/commands/validate.js'
import { runMe } from '../src/commands/me.js'
import { runGenerate } from '../src/commands/generate.js'
import { runConvert } from '../src/commands/convert.js'
import { runParse } from '../src/commands/parse.js'
import { recordingIO } from './helpers.js'

// Live smoke against the real beliq API. Skipped unless BELIQ_API_KEY is set,
// and excluded from the default `npm test`. Drives the real command functions
// through a real SDK client with a recording IO, so it exercises the same code
// path the CLI uses (read input, call the API, shape output, set the exit code).

const KEY = process.env.BELIQ_API_KEY
const live = KEY ? describe : describe.skip

const here = path.dirname(fileURLToPath(import.meta.url))
const invalidXml = readFileSync(path.join(here, '..', 'examples', 'invalid-xrechnung.xml'))
const invoiceJson = readFileSync(path.join(here, '..', 'examples', 'invoice.json'), 'utf8')

live('beliq-cli live (integration)', () => {
  const deps = { client: new Beliq({ apiKey: KEY as string, baseUrl: process.env.BELIQ_BASE_URL }) }

  it('me accepts the configured key and prints a summary', async () => {
    const { io, out } = recordingIO()
    const code = await runMe(parseArgs(['me']), deps, io)
    expect(code).toBe(0)
    expect(out()).toContain('org ')
  })

  it('validates the known-invalid XRechnung example to a failing verdict (exit 1)', async () => {
    const { io, out } = recordingIO(invalidXml)
    const code = await runValidate(parseArgs(['validate', 'example.xml', '--json']), deps, io)
    expect(code).toBe(1)
    const result = JSON.parse(out())
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('generates an XRechnung, converts it to UBL, and parses the result', async () => {
    // verify:false so the round-trip does not depend on full business-rule completeness.
    const gen = recordingIO(invoiceJson)
    expect(await runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'xrechnung', '--no-verify']), deps, gen.io)).toBe(0)
    const xml = gen.out()
    expect(xml).toContain('CrossIndustryInvoice')

    const conv = recordingIO(xml)
    expect(await runConvert(parseArgs(['convert', 'gen.xml', '--target-format', 'ubl', '--source-format', 'auto']), deps, conv.io)).toBe(0)
    const ubl = conv.out()
    expect(ubl).toContain('Invoice')

    const parsed = recordingIO(ubl)
    expect(await runParse(parseArgs(['parse', 'conv.xml', '--json']), deps, parsed.io)).toBe(0)
    expect(JSON.parse(parsed.out()).invoice.number).toBe('INV-2026-001')
  })
})
