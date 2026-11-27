import { APICallError, type TranscriptionModel } from 'ai';

export type TranscriptionModelV3Object = Extract<
  TranscriptionModel,
  { specificationVersion: 'v3' }
>;

export type TranscriptionCallOptions = Parameters<
  TranscriptionModelV3Object['doGenerate']
>[0];

export type TranscriptionGenerateResult = Awaited<
  ReturnType<TranscriptionModelV3Object['doGenerate']>
>;

export interface OpenAICompatibleTranscriptionConfig {
  provider: string;
  baseURL: string;
  apiKey?: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

function normalizeMediaType(mediaType: string | undefined): string {
  const base = (mediaType ?? 'audio/webm').split(';')[0]?.trim().toLowerCase();
  return base || 'audio/webm';
}

function resolveAudioFileName(mediaType: string): string {
  const ext = AUDIO_EXTENSION_BY_MIME[mediaType] ?? 'webm';
  return `recording.${ext}`;
}

function toAudioUint8Array(audio: Uint8Array | string): Uint8Array {
  if (typeof audio === 'string') {
    const cleanBase64 = audio.replace(/^data:[^;]+;base64,/, '').trim();
    return new Uint8Array(Buffer.from(cleanBase64, 'base64'));
  }
  return audio;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function extractOpenAiOptions(
  providerOptions: TranscriptionCallOptions['providerOptions'],
): Record<string, unknown> {
  if (!providerOptions || typeof providerOptions !== 'object') {
    return {};
  }
  const openaiOpts = providerOptions.openai;
  if (openaiOpts && typeof openaiOpts === 'object') {
    return openaiOpts as Record<string, unknown>;
  }
  const compatOpts = providerOptions['openai-compatible'];
  if (compatOpts && typeof compatOpts === 'object') {
    return compatOpts as Record<string, unknown>;
  }
  return {};
}

function extractProviderErrorMessage(
  responseBody: string,
  fallbackStatusText: string,
): string {
  if (!responseBody) {
    return fallbackStatusText || 'Transcription API request failed';
  }
  try {
    const parsed = JSON.parse(responseBody) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    if (
      parsed.error &&
      typeof parsed.error === 'object' &&
      'message' in parsed.error &&
      typeof parsed.error.message === 'string'
    ) {
      return parsed.error.message;
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Giữ thông báo fallback nếu body không phải JSON
  }
  return responseBody.slice(0, 300);
}

/**
 * Adapter chuẩn TranscriptionModelV3 gọi OpenAI-compatible `/audio/transcriptions`
 * dành cho Vercel AI SDK v6 `experimental_transcribe`.
 */
export class OpenAICompatibleTranscriptionModel
  implements TranscriptionModelV3Object
{
  readonly specificationVersion = 'v3' as const;
  readonly modelId: string;
  readonly provider: string;
  private readonly config: OpenAICompatibleTranscriptionConfig;

  constructor(modelId: string, config: OpenAICompatibleTranscriptionConfig) {
    this.modelId = modelId;
    this.provider = config.provider;
    this.config = config;
  }

  private getEndpointUrl(): string {
    const normalizedBase = this.config.baseURL.replace(/\/+$/, '');
    return normalizedBase.endsWith('/audio/transcriptions')
      ? normalizedBase
      : `${normalizedBase}/audio/transcriptions`;
  }

  async doGenerate(
    options: TranscriptionCallOptions,
  ): Promise<TranscriptionGenerateResult> {
    const endpointUrl = this.getEndpointUrl();
    const providerOpts = extractOpenAiOptions(options.providerOptions);
    const explicitMime =
      typeof providerOpts.mediaType === 'string' && providerOpts.mediaType.trim()
        ? providerOpts.mediaType
        : options.mediaType;
    const normalizedMime = normalizeMediaType(explicitMime);
    const audioBytes = toAudioUint8Array(options.audio);

    if (audioBytes.byteLength === 0) {
      throw new APICallError({
        message: 'Audio payload is empty',
        url: endpointUrl,
        requestBodyValues: { model: this.modelId, mediaType: normalizedMime },
        isRetryable: false,
      });
    }

    // Sao chép sang ArrayBuffer chuẩn để tương thích strict BlobPart trên mọi phiên bản TypeScript
    const byteCopy = new Uint8Array(audioBytes.byteLength);
    byteCopy.set(audioBytes);
    const audioBlob = new Blob([byteCopy.buffer], { type: normalizedMime });

    const formData = new FormData();
    formData.append('file', audioBlob, resolveAudioFileName(normalizedMime));
    formData.append('model', this.modelId);

    const responseFormat =
      typeof providerOpts.responseFormat === 'string' &&
      providerOpts.responseFormat.trim()
        ? providerOpts.responseFormat.trim()
        : 'verbose_json';
    formData.append('response_format', responseFormat);

    const temperature =
      typeof providerOpts.temperature === 'number' &&
      Number.isFinite(providerOpts.temperature)
        ? String(providerOpts.temperature)
        : '0';
    formData.append('temperature', temperature);

    if (
      typeof providerOpts.language === 'string' &&
      providerOpts.language.trim()
    ) {
      formData.append('language', providerOpts.language.trim());
    }

    if (typeof providerOpts.prompt === 'string' && providerOpts.prompt.trim()) {
      formData.append('prompt', providerOpts.prompt.trim());
    }

    const requestHeaders = new Headers();
    if (this.config.apiKey) {
      requestHeaders.set('Authorization', `Bearer ${this.config.apiKey}`);
    }

    const configHeaders = this.config.headers?.() ?? {};
    for (const [key, value] of Object.entries(configHeaders)) {
      if (typeof value === 'string') {
        requestHeaders.set(key, value);
      }
    }

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (
          typeof value === 'string' &&
          key.toLowerCase() !== 'content-type'
        ) {
          requestHeaders.set(key, value);
        }
      }
    }

    const fetchFn = this.config.fetch ?? globalThis.fetch;
    const response = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: formData,
      signal: options.abortSignal,
    });

    const responseHeaders = headersToRecord(response.headers);
    const responseBody = await response.text();

    if (!response.ok) {
      const errMsg = extractProviderErrorMessage(
        responseBody,
        response.statusText,
      );
      throw new APICallError({
        message: `Transcription request failed (${response.status}): ${errMsg}`,
        url: endpointUrl,
        requestBodyValues: {
          model: this.modelId,
          mediaType: normalizedMime,
          responseFormat,
        },
        statusCode: response.status,
        responseHeaders,
        responseBody,
        isRetryable:
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseBody) as Record<string, unknown>;
    } catch (cause) {
      throw new APICallError({
        message: 'Transcription endpoint returned invalid JSON response',
        url: endpointUrl,
        requestBodyValues: { model: this.modelId, mediaType: normalizedMime },
        statusCode: response.status,
        responseHeaders,
        responseBody,
        cause,
        isRetryable: false,
      });
    }

    const text = typeof parsed.text === 'string' ? parsed.text : '';
    const language =
      typeof parsed.language === 'string' && parsed.language.trim()
        ? parsed.language.trim()
        : undefined;
    const durationInSeconds =
      typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
        ? parsed.duration
        : undefined;

    const segments = Array.isArray(parsed.segments)
      ? parsed.segments
          .filter(
            (seg): seg is Record<string, unknown> =>
              Boolean(seg) && typeof seg === 'object',
          )
          .map((seg) => ({
            text: typeof seg.text === 'string' ? seg.text : '',
            startSecond:
              typeof seg.start === 'number' && Number.isFinite(seg.start)
                ? seg.start
                : 0,
            endSecond:
              typeof seg.end === 'number' && Number.isFinite(seg.end)
                ? seg.end
                : 0,
          }))
      : [];

    return {
      text,
      segments,
      language,
      durationInSeconds,
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
        body: parsed,
      },
    };
  }
}
