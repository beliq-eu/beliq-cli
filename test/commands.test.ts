import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { BeliqClient } from '../src/deps.js'
import { parseArgs } from '../src/args.js'
import { UsageError } from '../src/errors.js'
import { runValidate } from '../src/commands/validate.js'
import { runMe } from '../src/commands/me.js'
import { runParse } from '../src/commands/parse.js'
import { runGenerate } from '../src/commands/generate.js'
import { runConvert } from '../src/commands/convert.js'
import { recordingIO } from './helpers.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string): any => JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8'))

interface Call {
  method: string
  args: any[]
}

/**
 * A fake client that records calls and returns supplied results. The real Beliq
 * satisfies BeliqClient, so these tests drive the real command mapping, output
 * shaping, and exit-code logic; only the network is doubled.
 */
function fakeClient(over: Partial<Record<string, unknown>> = {}): { client: BeliqClient; calls: Call[] } {
  const calls: Call[] = []
  const rec =
    (method: string, value: () => unknown) =>
    async (...args: any[]) => {
      calls.push({ method, args })
      return value()
    }
  const client = {
    validate: rec('validate', () => over.validate ?? fixture('validate-invalid.json')),
    me: rec('me', () => over.me ?? fixture('account.json')),
    parse: rec(
      'parse',
      () =>
        over.parse ?? {
          format: 'cii',
          profileDetected: 'xrechnung',
          invoice: { number: 'INV-1', currencyCode: 'EUR', lines: [{}], totalGrossAmount: 1190 },
        },
    ),
    generate: rec(
      'generate',
      () =>
        over.generate ?? {
          contentType: 'application/xml',
          bytes: new TextEncoder().encode('<Invoice>generated</Invoice>'),
          meta: { schematronVersion: '1.2.3' },
        },
    ),
    convert: rec(
      'convert',
      () =>
        over.convert ?? {
          contentType: 'application/xml',
          bytes: new TextEncoder().encode('<Invoice>converted</Invoice>'),
          meta: { sourceFormat: 'cii', targetFormat: 'ubl', lostElementsCount: 0 },
        },
    ),
  } as unknown as BeliqClient
  return { client, calls }
}

describe('validate command', () => {
  it('prints the human verdict and returns exit 1 for an invalid document', async () => {
    const { client } = fakeClient()
    const { io, out } = recordingIO('<x/>')
    const code = await runValidate(parseArgs(['validate', 'x.xml']), { client }, io)
    expect(code).toBe(1)
    expect(out()).toContain('INVALID  cii (profile xrechnung)')
    expect(out()).toContain('BR-DE-15')
  })

  it('emits raw JSON on --json and nothing else on stdout', async () => {
    const { client } = fakeClient()
    const { io, out } = recordingIO('<x/>')
    const code = await runValidate(parseArgs(['validate', 'x.xml', '--json']), { client }, io)
    expect(code).toBe(1)
    const parsed = JSON.parse(out())
    expect(parsed.valid).toBe(false)
    expect(parsed.errors[0].ruleId).toBe('BR-DE-15')
  })

  it('returns exit 0 for a valid document', async () => {
    const { client } = fakeClient({ validate: fixture('validate-valid.json') })
    const { io } = recordingIO('<x/>')
    expect(await runValidate(parseArgs(['validate', 'x.xml']), { client }, io)).toBe(0)
  })

  it('fails a valid-with-warnings document under --fail-on warning', async () => {
    const { client } = fakeClient({ validate: fixture('validate-valid.json') })
    const { io } = recordingIO('<x/>')
    const code = await runValidate(parseArgs(['validate', 'x.xml', '--fail-on', 'warning']), { client }, io)
    expect(code).toBe(1)
  })

  it('maps --format through to the SDK call', async () => {
    const { client, calls } = fakeClient()
    const { io } = recordingIO('<x/>')
    await runValidate(parseArgs(['validate', 'x.xml', '--format', 'cii']), { client }, io)
    expect(calls[0].method).toBe('validate')
    expect(calls[0].args[1].format).toBe('cii')
  })

  it('rejects an out-of-range --format before calling the API', async () => {
    const { client, calls } = fakeClient()
    const { io } = recordingIO('<x/>')
    await expect(runValidate(parseArgs(['validate', 'x.xml', '--format', 'bogus']), { client }, io)).rejects.toBeInstanceOf(
      UsageError,
    )
    expect(calls).toHaveLength(0)
  })
})

describe('me command', () => {
  it('prints a human account summary', async () => {
    const { client } = fakeClient()
    const { io, out } = recordingIO()
    const code = await runMe(parseArgs(['me']), { client }, io)
    expect(code).toBe(0)
    expect(out()).toContain('org Acme GmbH')
    expect(out()).toContain('plan Growth')
    expect(out()).toContain('quota 137/10000 used')
  })
})

describe('parse command', () => {
  it('prints a one-line summary', async () => {
    const { client } = fakeClient()
    const { io, out } = recordingIO('<x/>')
    const code = await runParse(parseArgs(['parse', 'x.xml']), { client }, io)
    expect(code).toBe(0)
    expect(out()).toContain('Parsed a cii (profile xrechnung) document: invoice INV-1, 1 line, gross 1190 EUR')
  })
})

describe('generate command', () => {
  it('prints the XML to stdout, the summary to stderr, and maps the inputs', async () => {
    const { client, calls } = fakeClient()
    const { io, out, err } = recordingIO('{"number":"1"}')
    const code = await runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'xrechnung']), { client }, io)
    expect(code).toBe(0)
    expect(out()).toContain('<Invoice>generated</Invoice>')
    expect(err()).toContain('Generated a xrechnung xml document, checked against Schematron 1.2.3')
    const gen = calls.find((c) => c.method === 'generate')!
    expect(gen.args[0].standard).toBe('xrechnung')
    expect(gen.args[0].output).toBe('xml')
    expect(gen.args[0].verify).toBe(true)
    expect(gen.args[0].invoice).toEqual({ number: '1' })
  })

  it('sends verify:false with --no-verify', async () => {
    const { client, calls } = fakeClient()
    const { io } = recordingIO('{"number":"1"}')
    await runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'xrechnung', '--no-verify']), { client }, io)
    expect(calls.find((c) => c.method === 'generate')!.args[0].verify).toBe(false)
  })

  it('writes to a file with --output instead of stdout', async () => {
    const { client } = fakeClient()
    const { io, files, out } = recordingIO('{"number":"1"}')
    await runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'xrechnung', '--output', 'out.xml']), { client }, io)
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('out.xml')
    expect(out()).toBe('')
  })

  it('rejects a PDF result without --output', async () => {
    const { client } = fakeClient({
      generate: { contentType: 'application/pdf', bytes: new Uint8Array([1, 2]), meta: {} },
    })
    const { io } = recordingIO('{"number":"1"}')
    await expect(
      runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'zugferd', '--pdf']), { client }, io),
    ).rejects.toBeInstanceOf(UsageError)
  })

  it('rejects a non-JSON invoice as a usage error', async () => {
    const { client } = fakeClient()
    const { io } = recordingIO('not json at all')
    await expect(
      runGenerate(parseArgs(['generate', 'inv.json', '--standard', 'xrechnung']), { client }, io),
    ).rejects.toBeInstanceOf(UsageError)
  })

  it('requires --standard', async () => {
    const { client } = fakeClient()
    const { io } = recordingIO('{"number":"1"}')
    await expect(runGenerate(parseArgs(['generate', 'inv.json']), { client }, io)).rejects.toBeInstanceOf(UsageError)
  })
})

describe('convert command', () => {
  it('prints the converted XML and maps the target format', async () => {
    const { client, calls } = fakeClient()
    const { io, out } = recordingIO('<x/>')
    const code = await runConvert(parseArgs(['convert', 'x.xml', '--target-format', 'ubl']), { client }, io)
    expect(code).toBe(0)
    expect(out()).toContain('<Invoice>converted</Invoice>')
    expect(calls.find((c) => c.method === 'convert')!.args[1].targetFormat).toBe('ubl')
  })

  it('requires --target-format', async () => {
    const { client } = fakeClient()
    const { io } = recordingIO('<x/>')
    await expect(runConvert(parseArgs(['convert', 'x.xml']), { client }, io)).rejects.toBeInstanceOf(UsageError)
  })

  it('rejects a PDF target (facturx) without --output', async () => {
    const { client } = fakeClient({
      convert: { contentType: 'application/pdf', bytes: new Uint8Array([1]), meta: { targetFormat: 'facturx' } },
    })
    const { io } = recordingIO('<x/>')
    await expect(
      runConvert(parseArgs(['convert', 'x.xml', '--target-format', 'facturx']), { client }, io),
    ).rejects.toBeInstanceOf(UsageError)
  })
})
