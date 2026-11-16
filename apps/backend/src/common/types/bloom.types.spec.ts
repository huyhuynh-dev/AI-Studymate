import { describe, expect, it } from 'vitest';
import {
  BLOOM_LEVELS,
  computeBloomQuota,
  normalizeBloomLevel,
  resolveBloomPreset,
} from './bloom.types.js';

describe('bloom.types helpers', () => {
  describe('resolveBloomPreset', () => {
    it('prefers explicit standard presets over difficulty', () => {
      expect(resolveBloomPreset('exam_prep', 'basic')).toBe('exam_prep');
      expect(resolveBloomPreset('familiarize', 'advanced')).toBe('familiarize');
      expect(resolveBloomPreset('balanced', 'advanced')).toBe('balanced');
    });

    it('falls back to difficulty mapping when preset is custom or omitted', () => {
      expect(resolveBloomPreset(undefined, 'basic')).toBe('familiarize');
      expect(resolveBloomPreset(undefined, 'applied')).toBe('balanced');
      expect(resolveBloomPreset(undefined, 'advanced')).toBe('exam_prep');
      expect(resolveBloomPreset('custom', 'advanced')).toBe('exam_prep');
      expect(resolveBloomPreset()).toBe('balanced');
    });
  });

  describe('computeBloomQuota', () => {
    it.each([3, 5, 7, 10, 15, 30])(
      'allocates exact total equal to questionCount=%i across standard presets',
      (count) => {
        for (const preset of ['familiarize', 'balanced', 'exam_prep'] as const) {
          const quota = computeBloomQuota(count, preset);
          const total = BLOOM_LEVELS.reduce((sum, lvl) => sum + quota[lvl], 0);
          expect(total).toBe(count);
          for (const lvl of BLOOM_LEVELS) {
            expect(quota[lvl]).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(quota[lvl])).toBe(true);
          }
        }
      },
    );

    it('supports custom weights via Largest Remainder Method', () => {
      const quota = computeBloomQuota(10, 'custom', {
        remember: 0,
        understand: 20,
        apply: 50,
        analyze: 30,
      });
      expect(quota).toEqual({
        remember: 0,
        understand: 2,
        apply: 5,
        analyze: 3,
      });
    });

    it('falls back to balanced quota when custom weights sum to zero or invalid', () => {
      const fallback = computeBloomQuota(10, 'custom', {
        remember: -5,
        understand: 0,
        apply: Number.NaN,
        analyze: 0,
      });
      expect(fallback).toEqual(computeBloomQuota(10, 'balanced'));
    });
  });

  describe('normalizeBloomLevel', () => {
    it('normalizes canonical labels and aliases', () => {
      expect(normalizeBloomLevel('Remember')).toBe('remember');
      expect(normalizeBloomLevel('  hiểu ')).toBe('understand');
      expect(normalizeBloomLevel('vận dụng')).toBe('apply');
      expect(normalizeBloomLevel('evaluate')).toBe('analyze');
    });

    it('falls back by question type or returns null', () => {
      expect(normalizeBloomLevel('unknown', 'true_false')).toBe('remember');
      expect(normalizeBloomLevel(null, 'essay')).toBe('analyze');
      expect(normalizeBloomLevel(undefined, 'multiple_choice')).toBe('apply');
      expect(normalizeBloomLevel(undefined, 'single_choice')).toBe('understand');
      expect(normalizeBloomLevel('unknown')).toBeNull();
    });
  });
});
