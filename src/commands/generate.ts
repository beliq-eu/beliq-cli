import { LIVE_GENERATE_STANDARDS, type FacturxProfile, type Invoice } from '@beliq/sdk'
import { flagBool, flagStr, oneOf, requirePositional, type ParsedArgs } from '../args.js'
import { UsageError } from '../errors.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'
import { emitDocument } from './emit.js'

/**
 * Generate a compliant document from an EN 16931 invoice given as JSON. XML is
 * printed to stdout (or --output); a PDF must go to --output. verify defaults on
 * so a non-compliant document fails closed rather than being handed back.
 */
export async function runGenerate(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const file = requirePositional(args, 'beliq generate <invoice.json|-> --standard <standard>')
  const standard = oneOf(flagStr(args, 'standard'), LIVE_GENERATE_STANDARDS, 'standard')
  if (!standard) {
    throw new UsageError(`--standard is required (one of: ${LIVE_GENERATE_STANDARDS.join(', ')})`)
  }

  const raw = await io.readInput(file)
  let invoice: Invoice
  try {
    invoice = JSON.parse(new TextDecoder().decode(raw)) as Invoice
  } catch {
    const what = file === '-' ? 'stdin' : file
    throw new UsageError(`${what} is not valid JSON; generate takes an EN 16931 invoice as JSON`)
  }

  const output = flagBool(args, 'pdf') ? 'pdf' : 'xml'
  const seal = flagBool(args, 'seal')
  const result = await deps.client.generate({
    standard,
    invoice,
    output,
    facturxProfile: flagStr(args, 'facturx-profile') as FacturxProfile | undefined,
    verify: !flagBool(args, 'no-verify'),
    seal,
  })

  const checked = result.meta.schematronVersion
    ? `, checked against Schematron ${result.meta.schematronVersion}`
    : ''
  const sandbox = result.meta.livemode === false ? ' (sandbox)' : ''
  const meta: Record<string, unknown> = {
    output,
    contentType: result.contentType,
    schematronVersion: result.meta.schematronVersion,
    pdfKind: result.meta.pdfKind,
    outputEnvelope: result.meta.outputEnvelope,
    livemode: result.meta.livemode,
  }
  let summary = `Generated a ${standard} ${output} document${checked}${sandbox}.`
  if (seal) {
    meta.sha256 = result.sha256
    meta.rulesetSha256 = result.meta.rulesetSha256
    meta.validationResult = result.validationResult
    const verdict = result.validationResult
      ? ` Validation ${result.validationResult.valid ? 'passed' : 'failed'}.`
      : ''
    summary += ` sha256 ${result.sha256}.${verdict}`
  }

  return emitDocument(io, args, { kind: output, bytes: result.bytes, meta, summary })
}
