import {
  LIVE_CONVERT_SOURCE_FORMATS,
  LIVE_CONVERT_TARGET_FORMATS,
  LIVE_PROFILES,
  type ConvertSourceFormat,
  type ConvertTargetFormat,
  type FacturxProfile,
} from '@beliq/sdk'
import { sniffContentType } from '@beliq/sdk/helpers'
import { flagStr, oneOf, requirePositional, type ParsedArgs } from '../args.js'
import { UsageError } from '../errors.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'
import { emitDocument } from './emit.js'

/** The targets for which the API can hand a hybrid PDF source back as a PDF. */
const HYBRID_TARGETS = new Set<string>(['facturx', 'zugferd'])

/**
 * Convert a document from one EN 16931 format to another. The API returns XML
 * for every target, facturx and zugferd included: it does not wrap an XML
 * source into a hybrid PDF. A PDF comes back only when a hybrid PDF source
 * already is the target, and a PDF must go to --output. A 200 means the API
 * validated the converted XML before returning it; it carries no verdict, so
 * no check depth is printed. The count of lost elements is what the engine
 * recorded, and a loss it does not detect is not in it.
 */
export async function runConvert(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const file = requirePositional(args, 'beliq convert <file|-> --target-format <format>')
  const targetFormat = oneOf(flagStr(args, 'target-format'), LIVE_CONVERT_TARGET_FORMATS, 'target-format')
  if (!targetFormat) {
    throw new UsageError(`--target-format is required (one of: ${LIVE_CONVERT_TARGET_FORMATS.join(', ')})`)
  }
  const sourceFormat = oneOf(flagStr(args, 'source-format'), LIVE_CONVERT_SOURCE_FORMATS, 'source-format')
  // The flat list, not the per-standard one generate checks: the engine's
  // convert route resolves a profile the same way for both hybrid targets, and
  // the API ignores it for the others.
  const targetProfile = oneOf(flagStr(args, 'target-profile'), LIVE_PROFILES, 'target-profile')

  const bytes = await io.readInput(file)
  if (sniffContentType(bytes) === 'application/pdf' && HYBRID_TARGETS.has(targetFormat) && !flagStr(args, 'output')) {
    throw new UsageError(`a PDF source converted to ${targetFormat} can come back as a PDF and needs --output <file>`)
  }
  const result = await deps.client.convert(bytes, {
    targetFormat: targetFormat as ConvertTargetFormat,
    sourceFormat: sourceFormat as ConvertSourceFormat | undefined,
    targetProfile: targetProfile as FacturxProfile | undefined,
    contentType: flagStr(args, 'content-type'),
  })

  const kind: 'xml' | 'pdf' = result.contentType.includes('pdf') ? 'pdf' : 'xml'
  const from = result.meta.sourceFormat ? `${result.meta.sourceFormat} ` : ''
  const to = result.meta.targetFormat ?? targetFormat
  const lost =
    result.meta.lostElementsCount && result.meta.lostElementsCount > 0
      ? ` The engine recorded ${result.meta.lostElementsCount} source element(s) with no target equivalent.`
      : ''
  const sandbox = result.meta.livemode === false ? ' (sandbox)' : ''
  const checked =
    kind === 'pdf'
      ? ' The API validated the embedded XML before returning it; the PDF around it was not checked.'
      : ' The API validated the converted XML before returning it.'

  return emitDocument(io, args, {
    kind,
    bytes: result.bytes,
    meta: {
      sourceFormat: result.meta.sourceFormat,
      targetFormat: to,
      profileDetected: result.meta.profileDetected,
      lostElementsCount: result.meta.lostElementsCount,
      lostElements: result.meta.lostElements,
      conversionTools: result.meta.conversionTools,
      livemode: result.meta.livemode,
      contentType: result.contentType,
    },
    summary: `Converted ${from}to ${to}, returned as ${kind === 'pdf' ? 'a PDF' : 'XML'}${sandbox}.${checked}${lost}`,
  })
}
