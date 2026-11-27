"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { chatSessionsApi } from "@/services/chatSessions.api";
import {
  VOICE_INITIAL_NO_SPEECH_MS,
  VOICE_MAX_DURATION_MS,
  VOICE_RMS_SPEECH_THRESHOLD,
  VOICE_SILENCE_STOP_MS,
  VOICE_WAVEFORM_BAR_COUNT,
  computeByteTimeDomainRms,
  computeWaveformBars,
  pickSupportedAudioMimeType,
} from "../utils/voice-input.helper";

export type VoiceRecorderStatus = "idle" | "recording" | "transcribing";

export interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  resetKey?: string | null;
  disabled?: boolean;
}

export interface UseVoiceRecorderResult {
  status: VoiceRecorderStatus;
  durationMs: number;
  waveformBars: number[];
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearError: () => void;
}

type FinishReason = "transcribe" | "cancel" | "no_speech";

const IDLE_BARS = Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => 0.14);

function extractVoiceErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    if (Array.isArray(data?.message)) {
      return data.message.join(", ");
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Không thể chuyển giọng nói thành văn bản. Vui lòng thử lại.";
}

function mapMediaPermissionError(error: unknown): string {
  const errName =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
    return "Bạn chưa cấp quyền truy cập Micro. Hãy cho phép quyền Micro trên trình duyệt.";
  }
  if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
    return "Không tìm thấy thiết bị Micro nào đang kết nối.";
  }
  if (errName === "NotReadableError" || errName === "TrackStartError") {
    return "Micro đang được sử dụng bởi ứng dụng khác hoặc không thể đọc tín hiệu.";
  }
  return "Không thể khởi động Micro. Vui lòng kiểm tra thiết bị và thử lại.";
}

export function useVoiceRecorder({
  onTranscript,
  resetKey,
  disabled = false,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(IDLE_BARS);
  const [error, setError] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isMountedRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const finishReasonRef = useRef<FinishReason>("transcribe");
  const startedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const hasDetectedSpeechRef = useRef(false);
  const lastUiSyncAtRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recordingSessionNonceRef = useRef(0);

  const cleanupAudioPipeline = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Bỏ qua lỗi khi track đã dừng
        }
      });
      mediaStreamRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      void ctx.close().catch(() => {});
    }

    mediaRecorderRef.current = null;
  }, []);

  const stopRecorderWithReason = useCallback((reason: FinishReason) => {
    finishReasonRef.current = reason;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupAudioPipeline();
        if (isMountedRef.current) {
          setStatus("idle");
          setDurationMs(0);
          setWaveformBars(IDLE_BARS);
        }
      }
      return;
    }

    cleanupAudioPipeline();
    if (isMountedRef.current) {
      setStatus("idle");
      setDurationMs(0);
      setWaveformBars(IDLE_BARS);
    }
  }, [cleanupAudioPipeline]);

  const cancelRecording = useCallback(() => {
    recordingSessionNonceRef.current += 1;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    chunksRef.current = [];
    stopRecorderWithReason("cancel");

    if (isMountedRef.current) {
      setError(null);
      setStatus("idle");
      setDurationMs(0);
      setWaveformBars(IDLE_BARS);
    }
  }, [stopRecorderWithReason]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }
    const reason: FinishReason = hasDetectedSpeechRef.current
      ? "transcribe"
      : "no_speech";
    stopRecorderWithReason(reason);
  }, [stopRecorderWithReason]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Hủy phiên thu âm hoặc yêu cầu STT đang chạy khi chuyển Conversation hoặc unmount
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      cancelRecording();
    }
  }, [resetKey, cancelRecording]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      recordingSessionNonceRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cleanupAudioPipeline();
    };
  }, [cleanupAudioPipeline]);

  const startRecording = useCallback(async () => {
    if (disabled || status !== "idle") return;

    setError(null);

    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Trình duyệt hoặc kết nối hiện tại không hỗ trợ thu âm trực tiếp (cần HTTPS hoặc localhost).",
      );
      return;
    }

    const sessionNonce = ++recordingSessionNonceRef.current;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (permErr) {
      if (isMountedRef.current) {
        setError(mapMediaPermissionError(permErr));
      }
      return;
    }

    // Nếu người dùng đã rời trang hoặc hủy trong lúc hộp thoại xin quyền đang mở
    if (!isMountedRef.current || recordingSessionNonceRef.current !== sessionNonce) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        setError("Trình duyệt không hỗ trợ Web Audio API để phân tích âm thanh.");
        return;
      }

      const audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      sourceNode.connect(analyser);

      const mimeType = pickSupportedAudioMimeType((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      finishReasonRef.current = "transcribe";
      hasDetectedSpeechRef.current = false;

      const now = performance.now();
      startedAtRef.current = now;
      lastSpeechAtRef.current = now;
      lastUiSyncAtRef.current = 0;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupAudioPipeline();
        if (isMountedRef.current) {
          setStatus("idle");
          setDurationMs(0);
          setWaveformBars(IDLE_BARS);
          setError("Đã xảy ra lỗi trong quá trình ghi âm.");
        }
      };

      recorder.onstop = async () => {
        const finalReason = finishReasonRef.current;
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const chunks = [...chunksRef.current];
        chunksRef.current = [];
        cleanupAudioPipeline();

        if (
          !isMountedRef.current ||
          recordingSessionNonceRef.current !== sessionNonce
        ) {
          return;
        }

        setDurationMs(0);
        setWaveformBars(IDLE_BARS);

        if (finalReason === "cancel") {
          setStatus("idle");
          return;
        }

        if (finalReason === "no_speech" || !hasDetectedSpeechRef.current) {
          setStatus("idle");
          setError("Không phát hiện giọng nói. Vui lòng thử nói gần Micro hơn.");
          return;
        }

        const audioBlob = new Blob(chunks, { type: recordedType });
        if (audioBlob.size === 0) {
          setStatus("idle");
          setError("Không thu được dữ liệu âm thanh hợp lệ.");
          return;
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setStatus("transcribing");

        try {
          const result = await chatSessionsApi.transcribeAudio({
            audioBlob,
            signal: abortController.signal,
          });

          if (
            !isMountedRef.current ||
            recordingSessionNonceRef.current !== sessionNonce
          ) {
            return;
          }

          if (result.text) {
            onTranscriptRef.current(result.text);
          } else {
            setError("Không nhận diện được lời nói rõ ràng. Vui lòng thử lại.");
          }
        } catch (sttError: unknown) {
          if (
            abortController.signal.aborted ||
            axios.isCancel(sttError) ||
            !isMountedRef.current ||
            recordingSessionNonceRef.current !== sessionNonce
          ) {
            return;
          }
          setError(extractVoiceErrorMessage(sttError));
        } finally {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          if (
            isMountedRef.current &&
            recordingSessionNonceRef.current === sessionNonce
          ) {
            setStatus("idle");
          }
        }
      };

      setStatus("recording");
      setDurationMs(0);
      setWaveformBars(IDLE_BARS);
      recorder.start(250);

      const timeDomainBuffer = new Uint8Array(analyser.fftSize);
      const frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);

      const monitorAudioFrame = () => {
        if (
          !isMountedRef.current ||
          recordingSessionNonceRef.current !== sessionNonce ||
          !analyserRef.current ||
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state === "inactive"
        ) {
          return;
        }

        const currentNow = performance.now();
        const elapsedMs = currentNow - startedAtRef.current;

        analyserRef.current.getByteTimeDomainData(timeDomainBuffer);
        const rms = computeByteTimeDomainRms(timeDomainBuffer);

        if (rms >= VOICE_RMS_SPEECH_THRESHOLD) {
          hasDetectedSpeechRef.current = true;
          lastSpeechAtRef.current = currentNow;
        }

        if (elapsedMs >= VOICE_MAX_DURATION_MS) {
          stopRecorderWithReason(
            hasDetectedSpeechRef.current ? "transcribe" : "no_speech",
          );
          return;
        }

        if (
          hasDetectedSpeechRef.current &&
          currentNow - lastSpeechAtRef.current >= VOICE_SILENCE_STOP_MS
        ) {
          stopRecorderWithReason("transcribe");
          return;
        }

        if (
          !hasDetectedSpeechRef.current &&
          elapsedMs >= VOICE_INITIAL_NO_SPEECH_MS
        ) {
          stopRecorderWithReason("no_speech");
          return;
        }

        // Giới hạn tần suất cập nhật UI ~20fps để giữ mượt mà, tránh re-render quá dày
        if (currentNow - lastUiSyncAtRef.current >= 50) {
          lastUiSyncAtRef.current = currentNow;
          analyserRef.current.getByteFrequencyData(frequencyBuffer);
          setDurationMs(elapsedMs);
          setWaveformBars(computeWaveformBars(frequencyBuffer));
        }

        rafIdRef.current = requestAnimationFrame(monitorAudioFrame);
      };

      rafIdRef.current = requestAnimationFrame(monitorAudioFrame);
    } catch (setupError) {
      cleanupAudioPipeline();
      if (isMountedRef.current) {
        setStatus("idle");
        setError(extractVoiceErrorMessage(setupError));
      }
    }
  }, [cleanupAudioPipeline, disabled, status, stopRecorderWithReason]);

  return {
    status,
    durationMs,
    waveformBars,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  };
}
