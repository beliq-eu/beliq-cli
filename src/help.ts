import { createRequire } from 'node:module'
import {
  LIVE_CONVERT_SOURCE_FORMATS,
  LIVE_CONVERT_TARGET_FORMATS,
  LIVE_GENERATE_STANDARDS,
  LIVE_PARSE_FORMATS,
  LIVE_PROFILES,
  LIVE_VALIDATE_FORMATS,
} from '@beliq/sdk'

const require = createRequire(import.meta.url)

export function version(): string {
  const pkg = require('../package.json') as { version: string }
  return pkg.version
}

export const HELP = `beliq: validate, generate, parse, and convert EU e-invoices

Usage:
  beliq validate <file|dir|-> [<file|dir> ...] [--format ${LIVE_VALIDATE_FORMATS.join('|')}] [--fail-on error|warning] [--france-ctc] [--content-type <type>] [--json]
  beliq generate <invoice.json|-> --standard ${LIVE_GENERATE_STANDARDS.join('|')} [--pdf] [--facturx-profile ${LIVE_PROFILES.join('|')}] [--no-verify] [--seal] [--output <file>] [--json]
  beliq parse    <file|->  [--format ${LIVE_PARSE_FORMATS.join('|')}] [--content-type <type>] [--json]
  beliq convert  <file|->  --target-format ${LIVE_CONVERT_TARGET_FORMATS.join('|')} [--source-format ${LIVE_CONVERT_SOURCE_FORMATS.join('|')}] [--target-profile ${LIVE_PROFILES.join('|')}] [--content-type <type>] [--output <file>] [--json]
  beliq me                 [--json]

validate accepts an XML document or a ZUGFeRD/Factur-X PDF. Pass several files,
a shell glob, or a directory (its .xml/.pdf files, recursively) to validate a
batch: a per-file verdict, a summary, and one exit code for the whole run. A
directory is a batch even when it holds one file. For a PDF the verdict is about
the embedded XML; the PDF itself is not checked.

Each verdict carries the check depth as the API states it, or "check depth not
stated" where the API states none. What the depths mean:
https://docs.beliq.eu/compliance/how-verification-works/

validate --france-ctc also applies the French CTC rules (BR-FR-CTC). A result
that carries France CTC blocking rule ids fails the file with exit 1 under
every --fail-on, also where the verdict is VALID.

generate --facturx-profile applies to zugferd and facturx; extended-ctc-fr is
Factur-X only.

generate --seal also returns the document sha256 and validation verdict, so you
can prove which rules the document passed; hashing the output reproduces it.

convert returns XML for an XML source, facturx and zugferd included. A hybrid
PDF source sent to facturx or zugferd comes back as a PDF and needs --output:
the PDF as sent, its container not checked, when its embedded XML already is
the target; otherwise that PDF re-wrapped around the converted XML and passed
by veraPDF against PDF/A-3b. A
test key watermarks it after any veraPDF check. What the API does:
https://docs.beliq.eu/api-reference/convert/

convert --json lists in lostElements the source elements the engine recorded
as having no target equivalent; a loss it does not detect is not listed. When
the list would pass the API's 6 KB header cap, it holds one
{ "truncated": true } entry instead, and lostElementsCount stays the exact count.

--pdf gives a hybrid PDF/A-3 with the XML embedded for zugferd and facturx.
xrechnung and peppol-bis have no hybrid form, so --pdf returns a visualization
with no XML inside it, and their legal document stays the XML.

Global options:
  --api-key <key>   beliq API key (default: BELIQ_API_KEY)
  --base-url <url>  API base URL (default: BELIQ_BASE_URL, else https://api.beliq.eu)
  --auth <mode>     header (default, X-API-Key) or bearer
  --json            machine-readable JSON on stdout
  --content-type <type>
                    the input's media type (default: application/pdf when the
                    bytes start with %PDF-, else application/xml)
  -h, --help        show this help
  -v, --version     show the version

Exit codes:
  0  success, or a valid document
  1  document invalid, or France CTC blocking rule ids in its result
     (validate, per --fail-on); generate and convert exit 0 on a document
     they return, and generate leads its summary with any France CTC block
  2  usage error
  3  beliq API error, the API could not be reached, or an unexpected error
  4  I/O error

In batch mode the code covers the whole run: 0 if every file passes, 1 if a
document fails --fail-on or carries France CTC blocking rule ids, 3 if any file
could not be checked.

An outage (a 503 DATABASE_UNAVAILABLE, a 502 or 503 from a proxy, or no
connection) is retried for up to 15 minutes, plus the last attempt's deadline
of up to 90 seconds, before it ends in exit 3. The 15 minutes are beliq's own
choice, not a standard's. A batch stops at the first file it ends for and
reports the files after it as not checked.

A file argument of "-" reads from stdin. Set BELIQ_API_KEY (or pass --api-key)
with a key from the beliq dashboard; the free tier is enough to evaluate.
`
