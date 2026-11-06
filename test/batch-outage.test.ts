import { describe, it, expect } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Beliq } from '@beliq/sdk'
import { parseArgs } from '../src/args.js'
import { runValidate } from '../src/commands/validate.js'
import { recordingIO } from './helpers.js'

// A batch against a real SDK client and a real HTTP server on 127.0.0.1. The SDK
// retries an outage for minutes before it gives up, and every file of a batch
// would wait that long again, so a batch stops at the first file the API is
// unavailable for. `maxRetries: 0` keeps these runs short: what is under test is
// what the CLI does once the SDK has given up, not the SDK's retries.

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
}

const FILES = { 'a.xml': '<a/>', 'b.xml': '<b/>', 'c.xml': '<c/>' }

interface Report {
  total: number
  passed: number
  failed: number
  errored: number
  stoppedAt: string | null
  results: { file: string; status: string; message?: string }[]
}

async function batchReport(baseUrl: string): Promise<{ code: number; report: Report }> {
  const client = new Beliq({ apiKey: 'blq_test_batch', baseUrl, maxRetries: 0 })
  const { io, out } = recordingIO(FILES)
  const code = await runValidate(parseArgs(['validate', 'a.xml', 'b.xml', 'c.xml', '--json']), { client }, io)
  return { code, report: JSON.parse(out()) as Report }
}

describe('validate batch on an outage (real SDK, real server)', () => {
  it('stops at the first 503 DATABASE_UNAVAILABLE and lists the rest as not checked', async () => {
    let requests = 0
    const server = createServer((_req, res) => {
      requests++
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' })
      res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'database unavailable' } }))
    })
    try {
      const { code, report } = await batchReport(await listen(server))
      expect(code).toBe(3)
      expect(requests).toBe(1)
      expect(report).toMatchObject({ total: 3, passed: 0, failed: 0, errored: 3, stoppedAt: 'a.xml' })
      expect(report.results[0]).toMatchObject({ file: 'a.xml', status: 'error' })
      expect(report.results[0].message).toContain('DATABASE_UNAVAILABLE')
      for (const row of report.results.slice(1)) {
        expect(row.status).toBe('error')
        expect(row.message).toMatch(/^not checked: /)
        expect(row.message).toContain('a.xml')
      }
    } finally {
      await close(server)
    }
  })

  it('stops at the first refused connection', async () => {
    // A port that was just bound and released: nothing listens on it.
    const gone = createServer()
    const baseUrl = await listen(gone)
    await close(gone)

    const { code, report } = await batchReport(baseUrl)
    expect(code).toBe(3)
    expect(report.stoppedAt).toBe('a.xml')
    expect(report.results.map((r) => r.file)).toEqual(['a.xml', 'b.xml', 'c.xml'])
    expect(report.results[0].message).not.toMatch(/^not checked: /)
    expect(report.results[1].message).toMatch(/^not checked: /)
    expect(report.results[2].message).toMatch(/^not checked: /)
  })

  it('keeps checking the rest after a 504, which can be one slow document', async () => {
    let requests = 0
    const server = createServer((_req, res) => {
      requests++
      // What a proxy in front of the API sends: no beliq envelope.
      res.writeHead(504, { 'Content-Type': 'text/plain' })
      res.end('Gateway Timeout')
    })
    try {
      const { code, report } = await batchReport(await listen(server))
      expect(code).toBe(3)
      expect(requests).toBe(3)
      expect(report.stoppedAt).toBeNull()
      for (const row of report.results) expect(row.message).not.toMatch(/^not checked: /)
    } finally {
      await close(server)
    }
  })
})
