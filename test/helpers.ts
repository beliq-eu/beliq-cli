import type { IO } from '../src/io.js'
import { IoError } from '../src/errors.js'

/**
 * A recording IO: captures stdout/stderr and file writes, and feeds input for
 * readInput. Pass a single value for one document, or a map of path -> content
 * for a batch. `expandInputs` is the identity (the command under test decides
 * how many files it sees); the real directory-walking IO is tested separately
 * against a real filesystem. Lets a command test assert exactly what would be
 * written without touching real streams; paired with a real Beliq client it
 * also drives the live integration tests.
 */
export function recordingIO(input?: string | Uint8Array | Record<string, string | Uint8Array>): {
  io: IO
  out: () => string
  err: () => string
  files: { path: string; bytes: Uint8Array }[]
} {
  const outChunks: string[] = []
  const errLines: string[] = []
  const files: { path: string; bytes: Uint8Array }[] = []

  const toBytes = (v: string | Uint8Array): Uint8Array =>
    typeof v === 'string' ? new TextEncoder().encode(v) : v
  const isMap =
    input !== undefined && typeof input === 'object' && !(input instanceof Uint8Array)

  const io: IO = {
    stdout: (chunk) => outChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)),
    stderr: (line) => errLines.push(line),
    readInput: async (pathOrDash) => {
      if (isMap) {
        const map = input as Record<string, string | Uint8Array>
        const v = map[pathOrDash]
        if (v === undefined) throw new IoError(`could not read ${pathOrDash}: no such fixture`)
        return toBytes(v)
      }
      return input === undefined ? new Uint8Array() : toBytes(input as string | Uint8Array)
    },
    writeNewFile: async (path, bytes) => {
      files.push({ path, bytes })
    },
    expandInputs: async (paths) => paths,
  }

  return { io, out: () => outChunks.join(''), err: () => errLines.join('\n'), files }
}
