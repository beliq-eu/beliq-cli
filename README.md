# beliq-cli

Validate, generate, parse, and convert EU e-invoices (XRechnung, ZUGFeRD, Factur-X, Peppol BIS) from the terminal or CI, through the beliq API. Every verdict states how deep its check went.

The headline use is **validating e-invoices in CI**: point it at your invoice files, and an invalid document fails the build.

## Install

```bash
npm install -g beliq-cli
# or run without installing:
npx beliq-cli validate invoice.xml
```

Requires Node.js >= 20.15.

## Usage

```
beliq validate <file|dir|-> [<file|dir> ...] [--format auto|cii|ubl] [--fail-on error|warning] [--france-ctc] [--content-type <type>] [--json]
beliq generate <invoice.json|-> --standard xrechnung|zugferd|facturx|peppol-bis|fatturapa|facturae|eslog|ksef [--pdf] [--facturx-profile basicwl|en16931|extended|extended-ctc-fr] [--no-verify] [--seal] [--output <file>] [--json]
beliq parse    <file|->  [--format auto|cii|ubl] [--content-type <type>] [--json]
beliq convert  <file|->  --target-format cii|ubl|zugferd|facturx|xrechnung|peppol-bis [--source-format auto|cii|ubl|zugferd|facturx|xrechnung|peppol-bis] [--target-profile basicwl|en16931|extended|extended-ctc-fr] [--content-type <type>] [--output <file>] [--json]
beliq me                 [--json]
```

`--facturx-profile` applies to `zugferd` and `facturx`; `extended-ctc-fr` is Factur-X only. `generate --seal` also returns the document's sha256 and its validation verdict, so you can prove which rules the document passed. `--content-type` sets the input's media type for `validate`, `parse` and `convert`; without it, input starting with `%PDF-` is sent as `application/pdf` and anything else as `application/xml`.

`generate --pdf` returns a hybrid PDF/A-3 with the XML embedded for `zugferd` and `facturx`. `xrechnung` and `peppol-bis` have no hybrid form, so `--pdf` returns a visualization with no XML inside it, and their legal document stays the XML.

`validate` accepts an XML document or a ZUGFeRD/Factur-X PDF. A file argument of `-` reads from stdin. Pass several files, a shell glob, or a directory (its `.xml`/`.pdf` files, recursively) to validate a batch: you get a per-file verdict, a summary, and one exit code for the whole run. A directory is a batch even when it holds one file, so its `--json` shape does not depend on how many invoices it contains. `--france-ctc` also applies the French CTC rules (BR-FR-CTC) to each document. `--json` prints the raw API result (a report object in batch mode) as the only thing on stdout, so it pipes cleanly.

`convert` returns XML for every target, `facturx` and `zugferd` included: the API does not wrap an XML source into a hybrid PDF. A PDF comes back only when a hybrid PDF source already is the target, and it needs `--output`. A successful convert means the API validated the converted XML before returning it. For a `facturx` or `zugferd` target at profile `en16931` that validation is the one for plain EN 16931 CII: no Factur-X profile schema is checked. It prints no verdict and no check depth. When the engine recorded source elements with no target equivalent, the summary gives their count; a loss the engine does not detect is not counted.

`parse` prints a one-line summary and, below it, each warning the API sent about what the document holds and the parsed invoice does not.

## Reading a verdict

```
$ beliq validate invoice.xml
VALID  fatturapa (profile italy-fatturapa-ordinaria-fpr12)  Schema-checked
0 errors, 0 warnings
```

- `VALID` and `INVALID` are the API's `valid`. `valid` means the document passed the rule packs and schemas beliq runs for its format, in the versions the result names. It does not mean every recipient, validation tool or tax authority accepts it.
- The third field is the check depth, printed as the API sends it in `verificationBadgeLabel`. [How verification works](https://docs.beliq.eu/compliance/how-verification-works/) explains each depth. Where the API sends no label, the CLI prints `check depth not stated` and names no depth.
- For a PDF, a line says which embedded XML the verdict is about. The PDF itself is not checked.
- When the result carries `franceCtcBlockingRuleIds`, the CLI prints the API's message for them, with the rule ids, and fails the file with exit code 1 under every `--fail-on`, also where the verdict is `VALID`. The API reports those ids beside `valid` and does not fold them into it.
- The batch table has the same depth in its `DEPTH` column. `--json` carries every field of the API result.

`generate` names the same depth in its summary, and `not validated` with `--no-verify`. The verdict is about the invoice XML, so for `--pdf` the summary says so and names the kind of PDF.

```bash
# Validate a file, human-readable
beliq validate invoice.xml

# Validate a hybrid ZUGFeRD/Factur-X PDF (the embedded XML is checked)
beliq validate invoice.pdf

# Validate a whole folder of invoices (its .xml and .pdf files, recursively)
beliq validate ./invoices

# Validate from a pipe, machine-readable, fail the shell on any warning too
cat invoice.xml | beliq validate - --json --fail-on warning

# Generate an XRechnung from the example invoice, write the XML to stdout.
# The example ships in the npm package; in a clone of this repository it is
# examples/invoice.json.
beliq generate "$(npm root -g)/beliq-cli/examples/invoice.json" --standard xrechnung > invoice.xml

# Convert a CII document to a Peppol BIS UBL document
beliq convert invoice.xml --target-format peppol-bis --output peppol.xml
```

## Configuration

Every setting has a flag that overrides the environment variable.

| Variable | Flag | Required | Default | Description |
|---|---|---|---|---|
| `BELIQ_API_KEY` | `--api-key` | yes | | Your beliq API key. The free tier is enough to evaluate. |
| `BELIQ_BASE_URL` | `--base-url` | no | `https://api.beliq.eu` | Override only for a self-hosted deployment. |
| `BELIQ_AUTH` | `--auth` | no | `header` | How the key is sent: `header` (X-API-Key) or `bearer`. |

## Exit codes

The exit code is the contract that makes it useful in scripts and CI:

| Code | Meaning |
|---|---|
| 0 | success, or a valid document |
| 1 | document invalid (`validate`, per `--fail-on`), or a result that carries `franceCtcBlockingRuleIds` |
| 2 | usage error (bad flag, missing argument, missing API key, PDF without `--output`) |
| 3 | beliq API error (bad key, quota, engine, a rejected document), the API could not be reached (DNS, a refused connection, a timeout), or an unexpected error. Never a verdict on the document. |
| 4 | I/O error (unreadable input, or an output path that already exists) |

In batch mode (many files or a directory) the code covers the whole run: `0` if every file passes, `1` if a document fails `--fail-on` or carries `franceCtcBlockingRuleIds`, `3` if any file could not be checked (unreadable, or the API errored on it).

On an API error the message goes to stderr, followed by the failed rules when the API names them (`generate` and `convert` refuse a document that fails the API's validation with a 422 that lists them). With `--json`, stdout also gets the error as `{ "error": { "status", "code", "message", "details" } }`.

## In CI

Validate every invoice a build produces and fail on an invalid one:

```yaml
- run: npx beliq-cli validate dist/invoices --fail-on error
  env:
    BELIQ_API_KEY: ${{ secrets.BELIQ_API_KEY }}
```

`beliq validate` takes a directory, so this validates every `.xml`/`.pdf` invoice under `dist/invoices` in one run and fails the step if any is invalid. For a per-file step summary and job outputs on GitHub, use the Action `beliq-eu/beliq-validate-action`.

## Development

```bash
npm install
npm run build
npm test              # unit tests, no network
npm run scrub:check   # no em-dash
BELIQ_API_KEY=... npm run test:integration   # live smoke against the real API
```

## License

MIT
