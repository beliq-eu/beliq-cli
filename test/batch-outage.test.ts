import { describe, it, expect, vi } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Beliq, DEFAULT_MAX_RETRIES } from '@beliq/sdk'
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

type Handler = (req: IncomingMessage, res: ServerResponse) => void

// `Retry-After: 0` lets the SDK retry a budget failure many times inside a short
// budget, while a failure it retries by count stops after DEFAULT_MAX_RETRIES.
const answer =
  (status: number, code?: string): Handler =>
  (_req, res) => {
    if (code) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '0' })
      res.end(JSON.stringify({ success: false, error: { code, message: code } }))
    } else {
      res.writeHead(status, { 'Content-Type': 'text/plain', 'Retry-After': '0' })
      res.end('upstream unavailable')
    }
  }

const CASES: { name: string; handler: Handler; stops: boolean }[] = [
  { name: '503 DATABASE_UNAVAILABLE', handler: answer(503, 'DATABASE_UNAVAILABLE'), stops: true },
  { name: '503 with no beliq code', handler: answer(503), stops: true },
  { name: '502 with no beliq code', handler: answer(502), stops: true },
  { name: '503 ENGINE_UNAVAILABLE', handler: answer(503, 'ENGINE_UNAVAILABLE'), stops: false },
  { name: '502 ENGINE_UNAVAILABLE', handler: answer(502, 'ENGINE_UNAVAILABLE'), stops: false },
  { name: 'a connection closed after the request arrived', handler: (req) => req.socket.destroy(), stops: false },
]

/** Whether the installed SDK retries this failure past its count, which only its budget does. */
async function sdkRetriesPastCount(handler: Handler): Promise<boolean> {
  let requests = 0
  const server = createServer((req, res) => {
    requests++
    handler(req, res)
  })
  try {
    const client = new Beliq({ apiKey: 'blq_test_batch', baseUrl: await listen(server), retryBudgetMs: 1500 })
    await expect(client.validate('<a/>')).rejects.toBeDefined()
    return requests > DEFAULT_MAX_RETRIES + 1
  } finally {
    await close(server)
  }
}

describe('a batch stops exactly where the SDK retries by its budget', () => {
  it.each(CASES)('$name', async ({ handler, stops }) => {
    expect(await sdkRetriesPastCount(handler)).toBe(stops)

    const server = createServer(handler)
    try {
      const { code, report } = await batchReport(await listen(server))
      expect(code).toBe(3)
      expect(report.stoppedAt).toBe(stops ? 'a.xml' : null)
    } finally {
      await close(server)
    }
  })
})

// A failed connection cannot be staged on demand for every code, so here fetch
// itself throws what undici throws: "fetch failed" with the code in `cause`.
// Fake timers play out the SDK's default 15-minute budget in no time.
const failedFetch = (code: string) =>
  (async () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) })
  }) as unknown as typeof fetch

const THROWN: { code: string; stops: boolean }[] = [
  { code: 'ECONNREFUSED', stops: true },
  { code: 'ENOTFOUND', stops: true },
  { code: 'EAI_AGAIN', stops: true },
  { code: 'ENETUNREACH', stops: true },
  { code: 'EHOSTUNREACH', stops: true },
  { code: 'UND_ERR_CONNECT_TIMEOUT', stops: true },
  { code: 'ECONNRESET', stops: false },
  { code: 'UND_ERR_SOCKET', stops: false },
  { code: 'DEPTH_ZERO_SELF_SIGNED_CERT', stops: false },
]

async function sdkRetriesThrownPastCount(code: string): Promise<boolean> {
  let calls = 0
  const fetchImpl = failedFetch(code)
  const counting = (async (...args: Parameters<typeof fetch>) => {
    calls++
    return fetchImpl(...args)
  }) as typeof fetch
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  try {
    const client = new Beliq({ apiKey: 'blq_test_batch', baseUrl: 'http://127.0.0.1:9', fetch: counting })
    const outcome = client.validate('<a/>').then(
      () => 'resolved',
      () => 'rejected',
    )
    await vi.advanceTimersByTimeAsync(20 * 60_000)
    expect(await outcome).toBe('rejected')
    return calls > DEFAULT_MAX_RETRIES + 1
  } finally {
    vi.useRealTimers()
  }
}

describe('a batch stops on a thrown error exactly where the SDK retries it by its budget', () => {
  it.each(THROWN)('$code', async ({ code, stops }) => {
    expect(await sdkRetriesThrownPastCount(code)).toBe(stops)

    const client = new Beliq({ apiKey: 'blq_test_batch', baseUrl: 'http://127.0.0.1:9', maxRetries: 0, fetch: failedFetch(code) })
    const { io, out } = recordingIO(FILES)
    const exit = await runValidate(parseArgs(['validate', 'a.xml', 'b.xml', 'c.xml', '--json']), { client }, io)
    expect(exit).toBe(3)
    expect((JSON.parse(out()) as Report).stoppedAt).toBe(stops ? 'a.xml' : null)
  })
})
