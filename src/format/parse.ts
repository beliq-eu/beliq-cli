import type { ParseResult } from '@beliq/sdk'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/**
 * A summary of a parse: the detected syntax and profile, then the invoice
 * number, line count, and gross total, then each warning the API sent about
 * what the document holds and the parsed invoice does not. `--json` emits the
 * full result instead.
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
  const head = `Parsed a ${result.format}${profile} document: ${number}, ${plural(lines, 'line')}${gross}`

  const warnings = result.warnings ?? []
  if (warnings.length === 0) return head
  const listed = warnings.map((w) => {
    const field = w.field ? ` (field ${w.field})` : ''
    const terms = w.terms?.length ? ` Terms: ${w.terms.join(', ')}.` : ''
    const elements = w.elements?.length ? ` ${plural(w.elements.length, 'element path')}; --json lists them.` : ''
    return `- ${w.code}${field}: ${w.message}${terms}${elements}`
  })
  return [head, `${plural(warnings.length, 'warning')}:`, ...listed].join('\n')
}
