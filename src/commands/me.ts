import { flagBool, type ParsedArgs } from '../args.js'
import { EXIT } from '../exit.js'
import { renderAccountHuman } from '../format/account.js'
import type { Deps } from '../deps.js'
import type { IO } from '../io.js'

/** Report the account behind the API key (GET /v1/me, no quota drawn). */
export async function runMe(args: ParsedArgs, deps: Deps, io: IO): Promise<number> {
  const account = await deps.client.me()
  if (flagBool(args, 'json')) io.stdout(`${JSON.stringify(account, null, 2)}\n`)
  else io.stdout(`${renderAccountHuman(account)}\n`)
  return EXIT.OK
}
