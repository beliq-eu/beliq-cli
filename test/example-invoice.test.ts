import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The shipped example is what the README quickstart runs, so it has to be a
// document the API actually accepts. `verify` defaults to true, and an invoice
// that satisfies plain EN 16931 still fails the XRechnung CIUS on rules no
// generic example carries. This shape was proven live on all four standards
// beliq offers (2026-09-06); the assertions below name the rule each field
// answers, so a future edit that drops one fails here instead of in a user's
// first five minutes.

const here = path.dirname(fileURLToPath(import.meta.url))
const invoice = JSON.parse(
  readFileSync(path.join(here, '..', 'examples', 'invoice.json'), 'utf8'),
) as Record<string, any>

describe('examples/invoice.json', () => {
  it('carries the seller contact group BG-6 (BR-DE-2)', () => {
    expect(invoice.seller.contactName).toBeTruthy()
    expect(invoice.seller.phone).toBeTruthy()
  })

  it('carries payment instructions BG-16 (BR-DE-1)', () => {
    expect(invoice.paymentMeans).toBeTruthy()
    expect(invoice.paymentMeans.typeCode).toBeTruthy()
  })

  it('carries a VAT breakdown BG-23 matching every line (BR-CO-18, BR-S-01)', () => {
    expect(Array.isArray(invoice.taxSummary)).toBe(true)
    expect(invoice.taxSummary.length).toBeGreaterThan(0)
    for (const line of invoice.lines) {
      expect(
        invoice.taxSummary.some(
          (t: any) => t.vatCategoryCode === line.vatCategoryCode && t.vatRate === line.vatRate,
        ),
      ).toBe(true)
    }
  })

  it('gives both parties a Peppol electronic address (BT-34, BT-49)', () => {
    // `email` resolves as EAS `EM` on xrechnung but not on peppol-bis, where a
    // mailbox is not an SML-resolvable participant. An explicit endpoint is the
    // one rung every standard accepts.
    for (const party of ['seller', 'buyer'] as const) {
      expect(invoice[party].peppol?.schemeId).toBeTruthy()
      expect(invoice[party].peppol?.id).toBeTruthy()
    }
  })

  it('carries a buyerReference (BR-DE-15)', () => {
    expect(invoice.buyerReference).toBeTruthy()
  })

  it('states totals consistent with its lines (BR-CO-13, BR-CO-15)', () => {
    const net = invoice.lines.reduce((sum: number, l: any) => sum + l.lineTotal, 0)
    const tax = invoice.taxSummary.reduce((sum: number, t: any) => sum + t.taxAmount, 0)
    expect(invoice.totalNetAmount).toBe(net)
    expect(invoice.totalTaxAmount).toBe(tax)
    expect(invoice.totalGrossAmount).toBe(net + tax)
  })
})
