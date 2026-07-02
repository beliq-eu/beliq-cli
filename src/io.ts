import { readFile, writeFile, stat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { IoError } from './errors.js'

/**
 * The side-effect seam: reading input, writing an output file, and the two
 * output streams. Commands take an IO so tests inject a recording fake and
 * assert exactly what would be written, with no real filesystem or process
 * streams touched.
 */
export interface IO {
  /** The machine payload (JSON, or a piped XML document). Written verbatim. */
  stdout(chunk: string | Uint8Array): void
  /** Human diagnostics and summaries. A trailing newline is added. */
  stderr(line: string): void
  /** Read an input document as raw bytes; "-" reads stdin. Throws IoError on failure. */
  readInput(pathOrDash: string): Promise<Uint8Array>
  /** Write a new file, failing if it already exists. Throws IoError on failure. */
  writeNewFile(path: string, bytes: Uint8Array): Promise<void>
  /**
   * Expand positional inputs into an ordered, de-duplicated list of files. A
   * directory yields its `.xml`/`.pdf` files (recursive, sorted); a file is
   * taken as-is (any extension); "-" (stdin) passes through. Throws IoError on
   * an unreadable path.
   */
  expandInputs(paths: string[]): Promise<string[]>
}

async function readStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

export function nodeIO(): IO {
  return {
    stdout(chunk) {
      process.stdout.write(chunk)
    },
    stderr(line) {
      process.stderr.write(`${line}\n`)
    },
    async readInput(pathOrDash) {
      try {
        return pathOrDash === '-' ? await readStdin() : await readFile(pathOrDash)
      } catch (err) {
        const what = pathOrDash === '-' ? 'stdin' : pathOrDash
        throw new IoError(`could not read ${what}: ${(err as Error).message}`)
      }
    },
    async writeNewFile(path, bytes) {
      try {
        await writeFile(path, bytes, { flag: 'wx' })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new IoError(`a file already exists at ${path}; choose a path that does not exist`)
        }
        throw new IoError(`could not write ${path}: ${(err as Error).message}`)
      }
    },
    async expandInputs(paths) {
      const out: string[] = []
      const seen = new Set<string>()
      const add = (p: string): void => {
        if (!seen.has(p)) {
          seen.add(p)
          out.push(p)
        }
      }
      for (const p of paths) {
        if (p === '-') {
          add('-')
          continue
        }
        let info
        try {
          info = await stat(p)
        } catch (err) {
          throw new IoError(`could not read ${p}: ${(err as Error).message}`)
        }
        if (!info.isDirectory()) {
          add(p)
          continue
        }
        let entries
        try {
          entries = await readdir(p, { recursive: true, withFileTypes: true })
        } catch (err) {
          throw new IoError(`could not read directory ${p}: ${(err as Error).message}`)
        }
        const found = entries
          .filter((e) => e.isFile() && /\.(xml|pdf)$/i.test(e.name))
          .map((e) => join(e.parentPath, e.name))
          .sort()
        for (const f of found) add(f)
      }
      return out
    },
  }
}
