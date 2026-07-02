import type { ParseResult } from '@beliq/sdk'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/**
 * A one-line summary of a parse: the detected syntax and profile, then the
 * invoice number, line count, and gross total. `--json` emits the full parsed
 * invoice instead.
 */
export function renderParseHuman(result: ParseResult): string {
  const invoice = result.invoice
  const profile = result.profileDetected ? ` (profile ${result.profileDetected})` : ''
  const number = invoice?.number ? `invoice ${invoice.number}` : 'invoice'
  const lines = invoice?.lines?.length ?? 0
  const gross =
    invoice?.totalGrossAmount != null
      ? `, gross ${invoice.totalGrossAmount} ${invoice.currencyCode ?? ''}`.trimEnd()
      : ''
  return `Parsed a ${result.format}${profile} document: ${number}, ${plural(lines, 'line')}${gross}`
}
