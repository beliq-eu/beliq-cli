import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { main } from '../src/cli.js'
import { nodeIO, type IO } from '../src/io.js'

// main() end to end: real argv parsing, a real SDK client, real HTTP against a
// local server, and the real filesystem. Only the two output streams are
// captured. This is the exit-code contract the README promises and CI gates
// read, so every code is asserted through main() itself.

type Handler = (req: IncomingMessage, res: ServerResponse) => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function listen(handler: Handler): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

function capturingIO(): { io: IO; out: () => string; err: () => string } {
  const out: string[] = []
  const err: string[] = []
  const io: IO = {
    ...nodeIO(),
    stdout: (chunk) => out.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)),
    stderr: (line) => err.push(line),
  }
  return { io, out: () => out.join(''), err: () => err.join('\n') }
}

const rejectedInvoice = {
  valid: false,
  format: 'cii',
  profileDetected: 'xrechnung',
  errors: [{ ruleId: 'BR-DE-15', severity: 'error', location: '/rsm:CrossIndustryInvoice', message: 'Buyer reference is required' }],
  warnings: [],
}

let dir: string
let xml: string
let invoiceJson: string

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'beliq-cli-main-'))
  xml = path.join(dir, 'invoice.xml')
  invoiceJson = path.join(dir, 'invoice.json')
  await writeFile(xml, '<rsm:CrossIndustryInvoice/>')
  await writeFile(invoiceJson, JSON.stringify({ number: 'INV-1' }))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('main exit codes', () => {
  it('exits 3 with the API code when the key is refused', async () => {
    const api = await listen((_req, res) =>
      sendJson(res, 401, { success: false, error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } }),
    )
    try {
      const { io, out, err } = capturingIO()
      const code = await main(['validate', xml], io, { BELIQ_API_KEY: 'blq_test_x', BELIQ_BASE_URL: api.url })
      expect(code).toBe(3)
      expect(err()).toContain('API error 401 (INVALID_API_KEY): Invalid API key')
      expect(out()).toBe('')
    } finally {
      await api.close()
    }
  })

  it('exits 3, not 1, when the API cannot be reached', async () => {
    // Bind a port, then free it, so the connection is refused.
    const gone = await listen(() => {})
    await gone.close()

    const { io, out, err } = capturingIO()
    const code = await main(['validate', xml], io, { BELIQ_API_KEY: 'blq_test_x', BELIQ_BASE_URL: gone.url })
    expect(code).toBe(3)
    expect(err()).toMatch(/unexpected error: fetch failed \(.*ECONNREFUSED/)
    expect(out()).toBe('')
  })

  it('exits 4 when the input file cannot be read', async () => {
    const { io, err } = capturingIO()
    const code = await main(['validate', path.join(dir, 'missing.xml')], io, { BELIQ_API_KEY: 'blq_test_x' })
    expect(code).toBe(4)
    expect(err()).toContain('could not read')
  })

  it('exits 4 when --output already exists', async () => {
    const api = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/xml' })
      res.end('<Invoice/>')
    })
    try {
      const { io, err } = capturingIO()
      const code = await main(
        ['generate', invoiceJson, '--standard', 'xrechnung', '--output', xml],
        io,
        { BELIQ_API_KEY: 'blq_test_x', BELIQ_BASE_URL: api.url },
      )
      expect(code).toBe(4)
      expect(err()).toContain(`a file already exists at ${xml}`)
    } finally {
      await api.close()
    }
  })
})

describe('main on a rejected document', () => {
  const rejection = { success: false, error: { code: 'INVALID_INVOICE', message: 'Generated invoice failed validation', details: { validationResult: rejectedInvoice } } }

  it('prints the failed rules a generate 422 carries', async () => {
    const api = await listen((_req, res) => sendJson(res, 422, rejection))
    try {
      const { io, out, err } = capturingIO()
      const code = await main(['generate', invoiceJson, '--standard', 'xrechnung'], io, {
        BELIQ_API_KEY: 'blq_test_x',
        BELIQ_BASE_URL: api.url,
      })
      expect(code).toBe(3)
      expect(err()).toContain('API error 422 (INVALID_INVOICE): Generated invoice failed validation')
      expect(err()).toContain('BR-DE-15')
      expect(err()).toContain('Buyer reference is required')
      expect(out()).toBe('')
    } finally {
      await api.close()
    }
  })

  it('puts the error object on stdout under --json', async () => {
    const api = await listen((_req, res) => sendJson(res, 422, rejection))
    try {
      const { io, out } = capturingIO()
      const code = await main(['generate', invoiceJson, '--standard', 'xrechnung', '--json'], io, {
        BELIQ_API_KEY: 'blq_test_x',
        BELIQ_BASE_URL: api.url,
      })
      expect(code).toBe(3)
      const body = JSON.parse(out())
      expect(body.error.status).toBe(422)
      expect(body.error.code).toBe('INVALID_INVOICE')
      expect(body.error.details.validationResult.errors[0].ruleId).toBe('BR-DE-15')
    } finally {
      await api.close()
    }
  })

  it('prints no rule table when the error names no rules', async () => {
    const api = await listen((_req, res) =>
      sendJson(res, 400, { success: false, error: { code: 'PARSE_FAILED', message: 'Not an XML document' } }),
    )
    try {
      const { io, err } = capturingIO()
      const code = await main(['validate', xml], io, { BELIQ_API_KEY: 'blq_test_x', BELIQ_BASE_URL: api.url })
      expect(code).toBe(3)
      expect(err()).toBe('beliq: API error 400 (PARSE_FAILED): Not an XML document')
    } finally {
      await api.close()
    }
  })
})
