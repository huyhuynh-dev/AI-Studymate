import { beforeAll, describe, expect, it, vi } from 'vitest';

interface VoiceInputHelperModule {
  VOICE_WAVEFORM_BAR_COUNT: number;
  pickSupportedAudioMimeType: (
    isTypeSupported?: (mimeType: string) => boolean,
  ) => string;
  computeByteTimeDomainRms: (samples: ArrayLike<number>) => number;
  computeWaveformBars: (
    frequencyData: ArrayLike<number>,
    barCount?: number,
  ) => number[];
  formatRecordingDuration: (durationMs: number) => string;
  mergeTranscribedPromptText: (
    currentText: string,
    transcribedText: string,
  ) => string;
}

let voiceHelper: VoiceInputHelperModule;

beforeAll(async () => {
  voiceHelper = await vi.importActual<VoiceInputHelperModule>(
    '../../../client/src/components/layout/RightSidebar/utils/voice-input.helper.ts',
  );
});

describe('voice-input.helper (Client Voice Recording Utilities)', () => {
  it('picks the highest-priority supported MediaRecorder MIME type', () => {
    expect(
      voiceHelper.pickSupportedAudioMimeType(
        (mime) => mime === 'audio/mp4' || mime === 'audio/ogg',
      ),
    ).toBe('audio/mp4');

    expect(
      voiceHelper.pickSupportedAudioMimeType((mime) =>
        mime.startsWith('audio/webm'),
      ),
    ).toBe('audio/webm;codecs=opus');

    expect(voiceHelper.pickSupportedAudioMimeType(() => false)).toBe('');
  });

  it('computes normalized RMS energy accurately for silence vs speech', () => {
    const silence = new Uint8Array(128).fill(128);
    expect(voiceHelper.computeByteTimeDomainRms(silence)).toBe(0);

    const speech = new Uint8Array([128, 178, 78, 168, 88]);
    const rms = voiceHelper.computeByteTimeDomainRms(speech);
    expect(rms).toBeGreaterThan(0.2);
    expect(rms).toBeLessThanOrEqual(1);
  });

  it('maps frequency bins into normalized waveform bars', () => {
    const idleBars = voiceHelper.computeWaveformBars([]);
    expect(idleBars).toHaveLength(voiceHelper.VOICE_WAVEFORM_BAR_COUNT);
    expect(idleBars.every((v) => v === 0.14)).toBe(true);

    const activeFreq = new Uint8Array(64).fill(180);
    const activeBars = voiceHelper.computeWaveformBars(activeFreq, 16);
    expect(activeBars).toHaveLength(16);
    expect(activeBars.every((v) => v > 0.5 && v <= 1)).toBe(true);
  });

  it('formats recording duration cleanly in m:ss', () => {
    expect(voiceHelper.formatRecordingDuration(0)).toBe('0:00');
    expect(voiceHelper.formatRecordingDuration(5_900)).toBe('0:05');
    expect(voiceHelper.formatRecordingDuration(65_000)).toBe('1:05');
  });

  it('merges transcribed text cleanly into existing draft prompt without auto-sending', () => {
    expect(
      voiceHelper.mergeTranscribedPromptText('', '  Giải thích cây nhị phân  '),
    ).toBe('Giải thích cây nhị phân');
    expect(
      voiceHelper.mergeTranscribedPromptText(
        'Cho mình hỏi',
        'độ phức tạp thuật toán',
      ),
    ).toBe('Cho mình hỏi độ phức tạp thuật toán');
    expect(
      voiceHelper.mergeTranscribedPromptText(
        'Cho mình hỏi ',
        'độ phức tạp thuật toán',
      ),
    ).toBe('Cho mình hỏi độ phức tạp thuật toán');
    expect(
      voiceHelper.mergeTranscribedPromptText('Nội dung có sẵn', '   '),
    ).toBe('Nội dung có sẵn');
  });
});
