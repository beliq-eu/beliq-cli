#!/usr/bin/env node
import { main } from './cli.js'
import { nodeIO } from './io.js'

main(process.argv.slice(2), nodeIO()).then(
  (code) => {
    process.exitCode = code
  },
  (err) => {
    process.stderr.write(`beliq: fatal: ${(err as Error).message}\n`)
    process.exitCode = 1
  },
)
