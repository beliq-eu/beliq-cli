import type { Beliq } from '@beliq/sdk'

/**
 * The subset of the @beliq/sdk client the commands use. The real `Beliq`
 * satisfies it; tests inject a fake that records its call arguments and returns
 * recorded fixtures, so a command test exercises real input-mapping and output
 * shaping rather than a mock returning what it was told.
 */
export type BeliqClient = Pick<Beliq, 'validate' | 'me' | 'parse' | 'generate' | 'convert'>

export interface Deps {
  client: BeliqClient
}
