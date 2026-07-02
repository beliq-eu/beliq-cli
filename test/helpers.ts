import type { IO } from '../src/io.js'

/**
 * A recording IO: captures stdout/stderr and file writes, and feeds a fixed
 * input for readInput. Lets a command test assert exactly what would be written
 * without touching real streams or the filesystem; paired with a real Beliq
 * client it also drives the live integration tests.
 */
export function recordingIO(input?: string | Uint8Array): {
  io: IO
  out: () => string
  err: () => string
  files: { path: string; bytes: Uint8Array }[]
} {
  const outChunks: string[] = []
  const errLines: string[] = []
  const files: { path: string; bytes: Uint8Array }[] = []

  const io: IO = {
    stdout: (chunk) => outChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)),
    stderr: (line) => errLines.push(line),
    readInput: async () =>
      typeof input === 'string' ? new TextEncoder().encode(input) : (input ?? new Uint8Array()),
    writeNewFile: async (path, bytes) => {
      files.push({ path, bytes })
    },
  }

  return { io, out: () => outChunks.join(''), err: () => errLines.join('\n'), files }
}
