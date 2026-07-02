import type { AccountInfo } from '@beliq/sdk'

/**
 * A compact human-readable account summary for `beliq me`: the org, plan, and
 * key prefix, then the quota and rate limit. `--json` emits the raw AccountInfo.
 */
export function renderAccountHuman(account: AccountInfo): string {
  const lines: string[] = []

  const plan = account.plan?.name ? `plan ${account.plan.name}` : 'plan (none)'
  const key = account.keyPrefix ? `key ${account.keyPrefix}` : ''
  const org = `org ${account.org?.name ?? account.org?.id ?? 'unknown'}`
  lines.push([org, plan, key].filter(Boolean).join('  '))

  const quota = account.quota as
    | { limit: number; used: number; remaining: number; resetsAt?: string }
    | undefined
  if (quota) {
    const resets = quota.resetsAt ? ` (resets ${quota.resetsAt})` : ''
    lines.push(`quota ${quota.used}/${quota.limit} used, ${quota.remaining} remaining${resets}`)
  }
  if (typeof account.rateLimitPerMinute === 'number') {
    lines.push(`rate limit ${account.rateLimitPerMinute}/min`)
  }

  return lines.join('\n')
}
