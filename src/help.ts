import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function version(): string {
  const pkg = require('../package.json') as { version: string }
  return pkg.version
}

export const HELP = `beliq: validate, generate, parse, and convert EU e-invoices

Usage:
  beliq validate <file|->  [--format auto|cii|ubl] [--fail-on error|warning] [--content-type <mime>] [--json]
  beliq generate <invoice.json|-> --standard xrechnung|zugferd|facturx|peppol-bis [--pdf] [--facturx-profile <p>] [--no-verify] [--output <file>] [--json]
  beliq parse    <file|->  [--format auto|cii|ubl] [--json]
  beliq convert  <file|->  --target-format cii|ubl|zugferd|facturx|xrechnung|peppol-bis [--source-format <f>] [--target-profile <p>] [--output <file>] [--json]
  beliq me                 [--json]

Global options:
  --api-key <key>   beliq API key (default: BELIQ_API_KEY)
  --base-url <url>  API base URL (default: BELIQ_BASE_URL, else https://api.beliq.eu)
  --auth <mode>     header (default, X-API-Key) or bearer
  --json            machine-readable JSON on stdout
  -h, --help        show this help
  -v, --version     show the version

Exit codes:
  0  success, or a valid document
  1  document invalid (validate, per --fail-on)
  2  usage error
  3  beliq API error
  4  I/O error

A file argument of "-" reads from stdin. Set BELIQ_API_KEY (or pass --api-key)
with a key from the beliq dashboard; the free tier is enough to evaluate.
`
