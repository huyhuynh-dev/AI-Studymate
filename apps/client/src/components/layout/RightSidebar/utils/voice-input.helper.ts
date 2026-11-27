export const VOICE_MAX_DURATION_MS = 120_000;
export const VOICE_SILENCE_STOP_MS = 2_500;
export const VOICE_INITIAL_NO_SPEECH_MS = 5_000;
export const VOICE_RMS_SPEECH_THRESHOLD = 0.018;
export const VOICE_WAVEFORM_BAR_COUNT = 16;

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function pickSupportedAudioMimeType(
  isTypeSupported?: (mimeType: string) => boolean,
): string {
  if (typeof isTypeSupported !== "function") {
    return "";
  }
  for (const candidate of PREFERRED_AUDIO_MIME_TYPES) {
    if (isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

/**
 * Tính mức năng lượng RMS chuẩn hóa [0..1] từ dữ liệu time-domain 8-bit [0..255]
 * của Web Audio AnalyserNode (điểm 0 âm thanh nằm tại 128).
 */
export function computeByteTimeDomainRms(
  samples: ArrayLike<number>,
): number {
  const length = samples.length;
  if (!length) return 0;

  let sumSquares = 0;
  for (let i = 0; i < length; i += 1) {
    const normalized = (samples[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / length);
}

/**
 * Ánh xạ phổ tần số thành `barCount` cột biên độ chuẩn hóa [0.14..1]
 * dùng cho hiệu ứng sóng âm thời gian thực.
 */
export function computeWaveformBars(
  frequencyData: ArrayLike<number>,
  barCount = VOICE_WAVEFORM_BAR_COUNT,
): number[] {
  if (barCount <= 0) return [];
  if (!frequencyData.length) {
    return Array.from({ length: barCount }, () => 0.14);
  }

  // Tập trung dải tần giọng nói (phần nửa thấp–trung của FFT bins)
  const usableLength = Math.max(barCount, Math.floor(frequencyData.length * 0.65));
  const step = usableLength / barCount;
  const bars: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < frequencyData.length; j += 1) {
      sum += frequencyData[j];
      count += 1;
    }
    const avg = count > 0 ? sum / count / 255 : 0;
    const boosted = Math.min(1, Math.max(0.14, 0.14 + Math.pow(avg, 0.8) * 0.86));
    bars.push(Number(boosted.toFixed(3)));
  }

  return bars;
}

export function formatRecordingDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Nối tiếp văn bản chuyển đổi từ giọng nói vào nội dung đang soạn dở trong ô Chat Input.
 */
export function mergeTranscribedPromptText(
  currentText: string,
  transcribedText: string,
): string {
  const cleaned = transcribedText.trim();
  if (!cleaned) return currentText;
  if (!currentText) return cleaned;
  if (/\s$/.test(currentText)) {
    return `${currentText}${cleaned}`;
  }
  return `${currentText} ${cleaned}`;
}
