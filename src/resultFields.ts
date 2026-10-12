import type { ConvertResult, GenerateResult, ParseResult, ValidationResult } from '@beliq/sdk'

/**
 * What this CLI does with each field of a result the SDK types. `text` means
 * the human output reads it; `json` means it reaches the user through --json
 * only. Every map is checked against the SDK's type, so a field the API gains
 * fails the typecheck at the SDK bump until someone decides where it goes.
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
 * Generate and convert build their --json object field by field, so a field
 * can also be left out. `document` is the output itself, and `seal` fields are
 * printed with --seal only.
 */
export const GENERATE_FIELDS = {
  bytes: 'document',
  xml: 'document',
  contentType: 'json',
  sha256: 'seal',
  // The summary reads the check depth from it; the whole object is printed with --seal.
  validationResult: 'text',
  meta: 'json',
} as const satisfies Record<keyof GenerateResult, 'document' | 'text' | 'json' | 'seal'>

export const GENERATE_META_FIELDS = {
  schematronVersion: 'text',
  livemode: 'text',
  pdfKind: 'text',
  outputEnvelope: 'json',
  rulesetSha256: 'seal',
  // With --seal the verdict object carries the same list.
  rulesetArtifacts: 'seal',
} as const satisfies Record<keyof GenerateResult['meta'], 'text' | 'json' | 'seal'>

export const CONVERT_FIELDS = {
  bytes: 'document',
  contentType: 'json',
  meta: 'json',
} as const satisfies Record<keyof ConvertResult, 'document' | 'json'>

export const CONVERT_META_FIELDS = {
  sourceFormat: 'text',
  targetFormat: 'text',
  lostElementsCount: 'text',
  livemode: 'text',
  profileDetected: 'json',
  lostElements: 'json',
  conversionTools: 'json',
} as const satisfies Record<keyof ConvertResult['meta'], 'text' | 'json'>
