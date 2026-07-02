import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { nodeIO } from '../src/io.js'
import { IoError } from '../src/errors.js'

// expandInputs walks the real filesystem, so it is tested against a real temp
// directory rather than a fake seam.
describe('nodeIO.expandInputs', () => {
  it('expands a directory to its .xml/.pdf files, recursively and sorted', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'beliq-cli-'))
    try {
      await writeFile(path.join(dir, 'b.xml'), '<b/>')
      await writeFile(path.join(dir, 'a.pdf'), '%PDF-')
      await writeFile(path.join(dir, 'note.txt'), 'ignore me')
      await mkdir(path.join(dir, 'sub'))
      await writeFile(path.join(dir, 'sub', 'c.xml'), '<c/>')

      const files = await nodeIO().expandInputs([dir])
      expect(files).toEqual([
        path.join(dir, 'a.pdf'),
        path.join(dir, 'b.xml'),
        path.join(dir, 'sub', 'c.xml'),
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('takes an explicit file as-is (any extension), de-duplicates, and passes "-" through', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'beliq-cli-'))
    try {
      const f = path.join(dir, 'invoice.json')
      await writeFile(f, '{}')
      const files = await nodeIO().expandInputs([f, f, '-'])
      expect(files).toEqual([f, '-'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('throws IoError on a missing path', async () => {
    await expect(nodeIO().expandInputs(['/no/such/path.xml'])).rejects.toBeInstanceOf(IoError)
  })
})
