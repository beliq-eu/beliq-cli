import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LIVE_CONVERT_SOURCE_FORMATS, LIVE_CONVERT_TARGET_FORMATS, LIVE_GENERATE_STANDARDS, LIVE_PROFILES } from '@beliq/sdk'
import { BOOLEAN_FLAGS, VALUE_FLAGS } from '../src/args.js'
import { HELP } from '../src/help.js'

// A flag the parser accepts but neither --help nor the README names is one
// nobody can find, and an enum value missing from the usage line is one nobody
// knows is allowed. Both drifted before, so the parser's own flag sets and the
// SDK's value lists are the source these are checked against.

const here = path.dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(path.join(here, '..', 'README.md'), 'utf8')

describe('documented flag surface', () => {
  const flags = [...BOOLEAN_FLAGS, ...VALUE_FLAGS]

  it.each(flags)('--help names --%s', (flag) => {
    expect(HELP).toContain(`--${flag}`)
  })

  it.each(flags)('the README names --%s', (flag) => {
    expect(readme).toContain(`--${flag}`)
  })

  it('lists every value the enum flags accept', () => {
    const lists = {
      standard: LIVE_GENERATE_STANDARDS,
      'target-format': LIVE_CONVERT_TARGET_FORMATS,
      'source-format': LIVE_CONVERT_SOURCE_FORMATS,
      'facturx-profile': LIVE_PROFILES,
      'target-profile': LIVE_PROFILES,
    }
    for (const doc of [HELP, readme]) {
      for (const [flag, values] of Object.entries(lists)) {
        expect(doc).toContain(`--${flag} ${values.join('|')}`)
      }
    }
  })
})
