export type TelemetryProfile =
  | 'FAST'
  | 'STANDARD'
  | 'REASONING'
  | 'VISION'
  | 'EMBEDDING'
  | 'RERANK'
  | 'TRANSCRIPTION';

export interface ProfilePricingRate {
  readonly inputPerMillionUsd: number;
  readonly outputPerMillionUsd: number;
}

export const AI_PROFILE_PRICING_USD: Record<TelemetryProfile, ProfilePricingRate> = {
  FAST: { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  STANDARD: { inputPerMillionUsd: 0.5, outputPerMillionUsd: 1.5 },
  REASONING: { inputPerMillionUsd: 1.25, outputPerMillionUsd: 5.0 },
  VISION: { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
  EMBEDDING: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
  RERANK: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
  TRANSCRIPTION: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
};

export function estimateAiCostUsd(params: {
  profile: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const normalizedProfile = params.profile.toUpperCase() as TelemetryProfile;
  const rate =
    AI_PROFILE_PRICING_USD[normalizedProfile] ??
    AI_PROFILE_PRICING_USD.STANDARD;

  const promptCost =
    (Math.max(0, params.promptTokens) / 1_000_000) * rate.inputPerMillionUsd;
  const completionCost =
    (Math.max(0, params.completionTokens) / 1_000_000) *
    rate.outputPerMillionUsd;

  return Number((promptCost + completionCost).toFixed(8));
}
