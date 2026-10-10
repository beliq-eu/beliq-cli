import type { GenerateResult, ParseResult, ValidationResult } from '@beliq/sdk'

/**
 * What this CLI does with each field of a result the SDK types. `text` means
 * the human output reads it; `json` means it reaches the user through --json
 * only. Every map is checked against the SDK's type, so a field the API gains
 * fails the typecheck at the SDK bump until someone decides where it goes. A
 * field was dropped without notice three times before this file existed.
 */
type Handling = 'text' | 'json'

export const VALIDATION_FIELDS = {
  valid: 'text',
  verified: 'text',
  format: 'text',
  profileDetected: 'text',
  verificationBadgeLabel: 'text',
  schematronVersion: 'text',
  franceCtcBlockingRuleIds: 'text',
  rulesetChannel: 'text',
  rulesetFellBack: 'text',
  rulesetSunsetsOn: 'text',
  pdfInput: 'text',
  errors: 'text',
  warnings: 'text',
  // The label above is the display form of these two ids.
  verificationTier: 'json',
  verificationBadge: 'json',
  sha256: 'json',
  rulesetSha256: 'json',
  rulesetArtifacts: 'json',
  driftCheckedAt: 'json',
  ciusVersion: 'json',
  peppolVersion: 'json',
  facturxProfile: 'json',
  facturxVersion: 'json',
  franceCtcApplied: 'json',
  franceCtcVersion: 'json',
  franceExtendedCtcApplied: 'json',
  italyFatturapaXsdBundle: 'json',
  italyFatturapaRuntimeVersion: 'json',
  italySdiMessaggiXsdBundle: 'json',
  italySdiMessaggiXsdVersion: 'json',
  spainFacturaeXsdBundle: 'json',
  spainFacturaeRuntimeVersion: 'json',
  sloveniaEslogXsdBundle: 'json',
  sloveniaEslogRuntimeVersion: 'json',
  polandKsefFa3XsdBundle: 'json',
  polandKsefFa3RuntimeVersion: 'json',
  romaniaRoCiusVersion: 'json',
  netherlandsNlciusVersion: 'json',
} as const satisfies Record<keyof ValidationResult, Handling>

export const PARSE_FIELDS = {
  format: 'text',
  profileDetected: 'text',
  invoice: 'text',
  warnings: 'text',
  profileUrn: 'json',
  businessProcessId: 'json',
  franceCtcDetected: 'json',
} as const satisfies Record<keyof ParseResult, Handling>

/**
 * Generate builds its --json object field by field, so a field can also be
 * left out: `seal` fields are printed with --seal only, and `document` is the
 * output itself.
 */
export const GENERATE_FIELDS = {
  bytes: 'document',
  xml: 'document',
  contentType: 'json',
  sha256: 'seal',
  validationResult: 'seal',
  meta: 'json',
} as const satisfies Record<keyof GenerateResult, 'document' | 'json' | 'seal'>

export const GENERATE_META_FIELDS = {
  schematronVersion: 'text',
  livemode: 'text',
  pdfKind: 'json',
  outputEnvelope: 'json',
  rulesetSha256: 'seal',
  // With --seal the verdict object carries the same list.
  rulesetArtifacts: 'seal',
} as const satisfies Record<keyof GenerateResult['meta'], 'text' | 'json' | 'seal'>
