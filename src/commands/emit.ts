import { flagBool, flagStr, type ParsedArgs } from '../args.js'
import { UsageError } from '../errors.js'
import { EXIT } from '../exit.js'
import type { IO } from '../io.js'

/**
 * Emit a produced document (generate / convert). A PDF must go to --output; XML
 * without --output is written to stdout so it can be piped. The human summary
 * goes to stderr so it never mixes into piped bytes. `--json` writes the
 * metadata to stdout instead (plus the XML text for an XML result).
 */
export async function emitDocument(
  io: IO,
  args: ParsedArgs,
  opts: { kind: 'xml' | 'pdf'; bytes: Uint8Array; meta: Record<string, unknown>; summary: string },
): Promise<number> {
  const outputPath = flagStr(args, 'output')
  const json = flagBool(args, 'json')

  if (opts.kind === 'pdf' && !outputPath) {
    throw new UsageError('a PDF result needs --output <file> to write it to')
  }

  if (outputPath) {
    await io.writeNewFile(outputPath, opts.bytes)
    if (json) {
      io.stdout(`${JSON.stringify({ ...opts.meta, outputPath, bytesWritten: opts.bytes.byteLength }, null, 2)}\n`)
    } else {
      io.stderr(`${opts.summary} Written to ${outputPath} (${opts.bytes.byteLength} bytes).`)
    }
    return EXIT.OK
  }

  const xml = new TextDecoder().decode(opts.bytes)
  if (json) {
    io.stdout(`${JSON.stringify({ ...opts.meta, xml }, null, 2)}\n`)
  } else {
    io.stdout(xml.endsWith('\n') ? xml : `${xml}\n`)
    io.stderr(opts.summary)
  }
  return EXIT.OK
}
