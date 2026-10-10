import type { ValidationResult } from '@beliq/sdk'

/**
 * Printed where the API sent no badge label for a verdict. It names no depth,
 * so it claims none.
 */
export const DEPTH_NOT_STATED = 'check depth not stated'

/** The API's own entry in `warnings` that explains `franceCtcBlockingRuleIds`. */
const FRANCE_BLOCK_ENTRY = 'FRANCE_CTC_FINDINGS_BLOCK_TRANSMISSION'

interface Finding {
  ruleId: string
  message: string
}

/**
 * The verdict in the API's own words. `verified: false` means no ruleset ran
 * (generate with verify off), so neither word applies.
 */
export function verdictWord(result: Pick<ValidationResult, 'valid' | 'verified'>): string {
  if (result.verified === false) return 'NOT VALIDATED'
  return result.valid ? 'VALID' : 'INVALID'
}

/** The badge label the API sent, printed as it came, or the mark for none. */
export function checkDepth(result: Pick<ValidationResult, 'verificationBadgeLabel'>): string {
  return result.verificationBadgeLabel ?? DEPTH_NOT_STATED
}

/** The France CTC rule ids the API reports as ending a transmission; empty when it sent none. */
export function franceBlockingRuleIds(result: Pick<ValidationResult, 'franceCtcBlockingRuleIds'>): string[] {
  return result.franceCtcBlockingRuleIds ?? []
}

/**
 * The lines that explain a France CTC block: the API's own message for it when
 * the result carries one, then the rule ids.
 */
export function franceBlockLines(
  result: Pick<ValidationResult, 'franceCtcBlockingRuleIds' | 'warnings'>,
): string[] {
  const ids = franceBlockingRuleIds(result)
  if (ids.length === 0) return []
  const entry = ((result.warnings ?? []) as Finding[]).find((w) => w.ruleId === FRANCE_BLOCK_ENTRY)
  return [...(entry ? [entry.message] : []), `France CTC blocking rule ids: ${ids.join(', ')}`]
}

/** What the API says about a PDF input: which embedded file was read, and that the PDF was not checked. */
export function pdfInputLine(result: Pick<ValidationResult, 'pdfInput'>): string | undefined {
  const pdf = result.pdfInput
  if (!pdf) return undefined
  const name = pdf.attachmentName ? ` "${pdf.attachmentName}"` : ''
  const others =
    pdf.attachmentCandidates > 1
      ? ` ${pdf.attachmentCandidates} embedded files could be taken for the invoice, and nothing compared them.`
      : ''
  return (
    `PDF input: the verdict is about the embedded XML${name} (found by ${pdf.attachmentFoundBy}). ` +
    `The PDF itself was not checked.${others}`
  )
}

/** Which ruleset channel served the request, when it was not the default one. */
export function rulesetChannelLine(
  result: Pick<ValidationResult, 'rulesetChannel' | 'rulesetFellBack' | 'rulesetSunsetsOn'>,
): string | undefined {
  if (!result.rulesetChannel) return undefined
  const fellBack = result.rulesetFellBack ? ', which had nothing to reach, so the latest ruleset ran' : ''
  const sunset = result.rulesetSunsetsOn ? `; the retained ruleset is served until ${result.rulesetSunsetsOn}` : ''
  return `Ruleset channel: ${result.rulesetChannel}${fellBack}${sunset}`
}
