import { LIVE_PARSE_FORMATS, type ParseFormat } from '@beliq/sdk'
import { flagBool, flagStr, oneOf, requirePositional, type ParsedArgs } from '../args.js'
import { EXIT } from '../exit.js'
import { renderParseHuman } from '../format/parse.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'

/** Parse one document into a structured EN 16931 invoice. */
export async function runParse(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const file = requirePositional(args, 'beliq parse <file|->')
  const format = oneOf(flagStr(args, 'format'), LIVE_PARSE_FORMATS, 'format')

  const bytes = await io.readInput(file)
  const result = await deps.client.parse(bytes, {
    format: format as ParseFormat | undefined,
    contentType: flagStr(args, 'content-type'),
  })

  if (flagBool(args, 'json')) io.stdout(`${JSON.stringify(result, null, 2)}\n`)
  else io.stdout(`${renderParseHuman(result)}\n`)
  return EXIT.OK
}
