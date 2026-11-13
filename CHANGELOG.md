# Changelog

This file starts at 0.5.0. An earlier version has a heading here only for a
breaking change; the rest of its changes are in the git history between the
version tags (https://github.com/beliq-eu/beliq-cli/tags). 0.1.0 is on npm
without a tag. Dates are the npm publish date, in UTC.

## 0.5.0 - 2026-11-06

- `validate --format` also accepts `fatturapa`, `facturae`, `eslog` and
  `poland_ksef_fa3`.
- Breaking: `convert --json` prints each `lostElements` entry as an object with
  `path`, `value`, `reason`, `severity` and `acceptableLoss`. Before, each entry
  was the string `[object Object]`. When the list would pass the API's 6 KB
  header cap, it holds one `{ "truncated": true }` entry instead, and
  `lostElementsCount` stays the exact count.
- An outage (a 503 `DATABASE_UNAVAILABLE`, a 502 or 503 with no beliq error
  code, or no connection) is retried for up to 15 minutes, plus the last
  attempt's deadline of up to 90 seconds, before the command exits 3. Before,
  it was retried 3 times.
- A `validate` batch stops at the first file an outage ends. Each file after it
  is reported as not checked, and the run exits 3, as before.
- The batch `--json` report has a `stoppedAt` field: the file where an outage
  ended the batch, or `null`.

## 0.4.0 - 2026-10-12

- Breaking: `validate` exits 1 for a result that carries France CTC blocking
  rule ids, under every `--fail-on`, even when `valid` is true. Before, such a
  result could exit 0.

## 0.3.0 - 2026-09-23

- Breaking: when the API cannot be reached, or an unexpected error happens, the
  CLI exits 3, not 1.
- Breaking: a directory argument is always a batch, even when it holds one
  file, so its `--json` output is the batch report, not a single result.
- Breaking: `--auth` and `BELIQ_AUTH` refuse any value other than `header` or
  `bearer` with exit 2. Before, an unknown value was read as `header`.
- Breaking: `convert --target-profile` refuses a value outside `basicwl`,
  `en16931`, `extended` and `extended-ctc-fr` with exit 2. Before, the value
  was sent as given.
- Breaking: `validate --france-ctc` is sent to the API, so the French CTC rules
  apply. Before, the flag was read but not sent, and did nothing.
