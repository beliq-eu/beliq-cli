import {
  LIVE_CONVERT_SOURCE_FORMATS,
  LIVE_CONVERT_TARGET_FORMATS,
  type ConvertSourceFormat,
  type ConvertTargetFormat,
  type FacturxProfile,
} from '@beliq/sdk'
import { flagStr, oneOf, requirePositional, type ParsedArgs } from '../args.js'
import { UsageError } from '../errors.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'
import { emitDocument } from './emit.js'

/** Convert targets that produce a hybrid PDF rather than an XML document. */
const PDF_TARGETS = new Set<string>(['facturx', 'zugferd'])

/**
 * Convert a document from one EN 16931 format to another. An XML target is
 * printed to stdout (or --output); a PDF target (facturx / zugferd) must go to
 * --output. Elements the conversion could not carry across are surfaced so a
 * lossy conversion is visible.
 */
export async function runConvert(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const file = requirePositional(args, 'beliq convert <file|-> --target-format <format>')
  const targetFormat = oneOf(flagStr(args, 'target-format'), LIVE_CONVERT_TARGET_FORMATS, 'target-format')
  if (!targetFormat) {
    throw new UsageError(`--target-format is required (one of: ${LIVE_CONVERT_TARGET_FORMATS.join(', ')})`)
  }
  const sourceFormat = oneOf(flagStr(args, 'source-format'), LIVE_CONVERT_SOURCE_FORMATS, 'source-format')

  const bytes = await io.readInput(file)
  const result = await deps.client.convert(bytes, {
    targetFormat: targetFormat as ConvertTargetFormat,
    sourceFormat: sourceFormat as ConvertSourceFormat | undefined,
    targetProfile: flagStr(args, 'target-profile') as FacturxProfile | undefined,
    contentType: flagStr(args, 'content-type'),
  })

  const kind: 'xml' | 'pdf' = PDF_TARGETS.has(targetFormat) ? 'pdf' : 'xml'
  const from = result.meta.sourceFormat ? `${result.meta.sourceFormat} ` : ''
  const to = result.meta.targetFormat ?? targetFormat
  const lost =
    result.meta.lostElementsCount && result.meta.lostElementsCount > 0
      ? ` ${result.meta.lostElementsCount} element(s) could not be carried across.`
      : ''

  return emitDocument(io, args, {
    kind,
    bytes: result.bytes,
    meta: {
      sourceFormat: result.meta.sourceFormat,
      targetFormat: to,
      profileDetected: result.meta.profileDetected,
      lostElementsCount: result.meta.lostElementsCount,
      lostElements: result.meta.lostElements,
      contentType: result.contentType,
    },
    summary: `Converted ${from}to ${to}.${lost}`,
  })
}
