export const BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
] as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const BLOOM_PRESETS = [
  'familiarize',
  'balanced',
  'exam_prep',
  'custom',
] as const;

export type BloomPreset = (typeof BLOOM_PRESETS)[number];
export type StandardBloomPreset = Exclude<BloomPreset, 'custom'>;
export type BloomDistribution = Record<BloomLevel, number>;

export const BLOOM_PRESET_WEIGHTS: Record<
  StandardBloomPreset,
  BloomDistribution
> = {
  familiarize: { remember: 40, understand: 35, apply: 20, analyze: 5 },
  balanced: { remember: 25, understand: 30, apply: 30, analyze: 15 },
  exam_prep: { remember: 10, understand: 20, apply: 40, analyze: 30 },
};

const DIFFICULTY_TO_PRESET: Record<
  'basic' | 'applied' | 'advanced',
  StandardBloomPreset
> = {
  basic: 'familiarize',
  applied: 'balanced',
  advanced: 'exam_prep',
};

const BLOOM_ALIASES: Record<string, BloomLevel> = {
  remember: 'remember',
  remembering: 'remember',
  recall: 'remember',
  nho: 'remember',
  nhớ: 'remember',
  understand: 'understand',
  understanding: 'understand',
  comprehension: 'understand',
  hieu: 'understand',
  hiểu: 'understand',
  apply: 'apply',
  applying: 'apply',
  application: 'apply',
  van_dung: 'apply',
  'vận dụng': 'apply',
  analyze: 'analyze',
  analyse: 'analyze',
  analyzing: 'analyze',
  analysis: 'analyze',
  evaluate: 'analyze',
  create: 'analyze',
  phan_tich: 'analyze',
  'phân tích': 'analyze',
};

/**
 * Suy luận chế độ phân bổ Bloom chuẩn hóa từ preset tường minh hoặc độ khó truyền thống.
 */
export function resolveBloomPreset(
  preset?: BloomPreset,
  difficulty?: 'basic' | 'applied' | 'advanced',
): StandardBloomPreset {
  if (preset && preset !== 'custom' && preset in BLOOM_PRESET_WEIGHTS) {
    return preset;
  }
  if (difficulty && difficulty in DIFFICULTY_TO_PRESET) {
    return DIFFICULTY_TO_PRESET[difficulty];
  }
  return 'balanced';
}

/**
 * Tính số câu hỏi mục tiêu cho 4 bậc nhận thức Bloom bằng thuật toán Largest Remainder Method,
 * đảm bảo tổng số câu luôn khớp chính xác với `questionCount`.
 */
export function computeBloomQuota(
  questionCount: number,
  preset: BloomPreset = 'balanced',
  customWeights?: Partial<Record<BloomLevel, number>>,
): BloomDistribution {
  const safeCount = Math.max(1, Math.floor(Number(questionCount) || 1));
  const baseWeights =
    preset === 'custom' && customWeights
      ? buildNormalizedWeights(customWeights)
      : BLOOM_PRESET_WEIGHTS[resolveBloomPreset(preset)];

  const totalWeight = BLOOM_LEVELS.reduce(
    (sum, level) => sum + baseWeights[level],
    0,
  );

  if (totalWeight <= 0) {
    return computeBloomQuota(safeCount, 'balanced');
  }

  const exactParts = BLOOM_LEVELS.map((level, index) => {
    const exact = (safeCount * baseWeights[level]) / totalWeight;
    const floorVal = Math.floor(exact);
    return {
      level,
      index,
      floorVal,
      remainder: exact - floorVal,
      weight: baseWeights[level],
    };
  });

  let assigned = exactParts.reduce((sum, item) => sum + item.floorVal, 0);
  const byRemainder = [...exactParts].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.index - b.index;
  });

  const quota: BloomDistribution = {
    remember: 0,
    understand: 0,
    apply: 0,
    analyze: 0,
  };

  for (const item of exactParts) {
    quota[item.level] = item.floorVal;
  }

  let cursor = 0;
  while (assigned < safeCount && byRemainder.length > 0) {
    const target = byRemainder[cursor % byRemainder.length];
    if (target.weight > 0 || totalWeight === 0) {
      quota[target.level] += 1;
      assigned += 1;
    }
    cursor += 1;
    if (cursor > safeCount * BLOOM_LEVELS.length) break;
  }

  return quota;
}

function buildNormalizedWeights(
  customWeights: Partial<Record<BloomLevel, number>>,
): BloomDistribution {
  return {
    remember: sanitizeWeight(customWeights.remember),
    understand: sanitizeWeight(customWeights.understand),
    apply: sanitizeWeight(customWeights.apply),
    analyze: sanitizeWeight(customWeights.analyze),
  };
}

function sanitizeWeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * Chuẩn hóa nhãn bậc Bloom đọc từ LLM hoặc Database.
 * Có hỗ trợ fallback theo loại câu hỏi nếu cần thiết.
 */
export function normalizeBloomLevel(
  raw: unknown,
  fallbackType?: string,
): BloomLevel | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase();
    if (key in BLOOM_ALIASES) {
      return BLOOM_ALIASES[key];
    }
  }

  if (!fallbackType) return null;
  switch (fallbackType) {
    case 'short_answer':
    case 'true_false':
      return 'remember';
    case 'multiple_choice':
      return 'apply';
    case 'essay':
      return 'analyze';
    case 'single_choice':
    default:
      return 'understand';
  }
}
