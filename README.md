# beliq-cli

Validate, generate, parse, and convert EU e-invoices (XRechnung, ZUGFeRD, Factur-X, Peppol BIS) from the terminal or CI, against beliq's authority-pinned, drift-checked rules.

The headline use is **validating e-invoices in CI**: point it at your invoice files, and a non-compliant document fails the build.

## Install

```bash
npm install -g beliq-cli
# or run without installing:
npx beliq-cli validate invoice.xml
```

Requires Node.js >= 20.15.

## Usage

```
beliq validate <file|->  [--format auto|cii|ubl] [--fail-on error|warning] [--content-type <mime>] [--json]
beliq generate <invoice.json|-> --standard xrechnung|zugferd|facturx|peppol-bis [--pdf] [--facturx-profile <p>] [--no-verify] [--output <file>] [--json]
beliq parse    <file|->  [--format auto|cii|ubl] [--json]
beliq convert  <file|->  --target-format cii|ubl|zugferd|facturx|xrechnung|peppol-bis [--source-format <f>] [--target-profile <p>] [--output <file>] [--json]
beliq me                 [--json]
```

A file argument of `-` reads from stdin. `--json` prints the raw API result as the only thing on stdout, so it pipes cleanly.

```bash
# Validate a file, human-readable
beliq validate invoice.xml

# Validate from a pipe, machine-readable, fail the shell on any warning too
cat invoice.xml | beliq validate - --json --fail-on warning

# Generate an XRechnung from a JSON invoice, write the XML to stdout
beliq generate examples/invoice.json --standard xrechnung > invoice.xml

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
| 1 | document invalid (`validate`, per `--fail-on`) |
| 2 | usage error (bad flag, missing argument, missing API key, PDF without `--output`) |
| 3 | beliq API error (bad key, quota, engine, a rejected document) |
| 4 | I/O error (unreadable input, or an output path that already exists) |

## In CI

Validate every invoice a build produces and fail on a non-compliant one:

```yaml
- run: |
    for f in dist/invoices/*.xml; do
      npx beliq-cli validate "$f" --fail-on error
    done
  env:
    BELIQ_API_KEY: ${{ secrets.BELIQ_API_KEY }}
```

`beliq validate` takes one file (or `-` for stdin), so the shell expands the glob and the step fails on the first non-compliant document. For glob handling, a per-file step summary, and job outputs, use the GitHub Action `beliq-eu/beliq-validate-action`.

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
