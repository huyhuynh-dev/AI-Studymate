export type SuperDocStreamTextMode =
  | 'replace'
  | 'before'
  | 'after'
  | 'append'
  | 'paragraphBefore'
  | 'paragraphAfter';

export const STREAM_TEXT_MODES: ReadonlySet<string> = new Set([
  'replace',
  'before',
  'after',
  'append',
  'paragraphBefore',
  'paragraphAfter',
]);

export const NON_STREAMING_TEXT_ACTIONS: ReadonlySet<string> = new Set([
  'insert_paragraphs',
  'insert_heading',
  'replace_text',
  'rewrite_block',
  'fill_placeholders',
]);

export const STREAMING_BLOCKED_API_OPS: ReadonlySet<string> = new Set([
  'doc.insert',
  'doc.replace',
  'doc.create.paragraph',
  'doc.create.heading',
  'doc.blocks.insert',
  'doc.mutations.apply',
  'doc.diff.apply',
]);

export const SOURCE_METADATA_API_OPS: ReadonlySet<string> = new Set([
  'doc.citations.sources.insert',
  'doc.citations.sources.update',
  'doc.citations.sources.remove',
]);

export const UNVERIFIED_TRACKED_INSERTION_API_OPS: ReadonlySet<string> = new Set([
  'doc.citations.insert',
  'doc.citations.bibliography.insert',
  'doc.citations.bibliography.configure',
  'doc.citations.bibliography.rebuild',
  'doc.citations.bibliography.remove',
]);

export interface ValidatedStreamTextArgs {
  mode: SuperDocStreamTextMode;
  anchor: string | null;
  text: string;
}

export function normalizeNativeOperationId(opId: unknown): string {
  if (typeof opId !== 'string') return '';
  const trimmed = opId.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('doc.') ? trimmed : `doc.${trimmed}`;
}

export function extractNativeApiCalls(
  args: Record<string, unknown>,
): Array<Record<string, unknown>> {
  if (Array.isArray(args.calls)) {
    return args.calls.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
  }
  return [args];
}

export function filterToolkitPerformActionTool(rawTool: {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}): {
  description?: string;
  inputSchema?: Record<string, unknown>;
} {
  const clonedSchema = rawTool.inputSchema
    ? (structuredClone(rawTool.inputSchema) as Record<string, unknown>)
    : undefined;

  if (
    clonedSchema &&
    typeof clonedSchema.properties === 'object' &&
    clonedSchema.properties !== null
  ) {
    const props = clonedSchema.properties as Record<string, unknown>;
    const actionProp = props.action;
    if (
      typeof actionProp === 'object' &&
      actionProp !== null &&
      Array.isArray((actionProp as Record<string, unknown>).enum)
    ) {
      const actionObj = actionProp as Record<string, unknown>;
      const filteredEnum = (actionObj.enum as unknown[]).filter(
        (name) => typeof name === 'string' && !NON_STREAMING_TEXT_ACTIONS.has(name),
      );
      actionObj.enum = filteredEnum;

      const availableList = filteredEnum.join(', ');
      const updatedDescription = `Document structure, formatting, review and other native actions. Ordinary prose and heading text MUST be written with superdoc_stream_text; insert_paragraphs, insert_heading, replace_text, rewrite_block and fill_placeholders are unavailable. After streaming a heading, use apply_style with headingLevel; after streaming styled prose, use format_text. Available actions: ${availableList || 'see schema'}. The following SDK reference documents the remaining actions; any legacy text-writing actions it mentions are unavailable:\n\n${rawTool.description ?? ''}`;

      return {
        description: updatedDescription,
        inputSchema: clonedSchema,
      };
    }
  }

  return {
    description: rawTool.description
      ? `Document structure, formatting, review and other native actions. Ordinary prose and heading text MUST be written with superdoc_stream_text (insert_paragraphs, insert_heading, replace_text, rewrite_block and fill_placeholders are unavailable).\n\n${rawTool.description}`
      : undefined,
    inputSchema: clonedSchema,
  };
}

export function validateStreamTextArgs(
  args: Record<string, unknown>,
):
  | { valid: true; normalized: ValidatedStreamTextArgs }
  | { valid: false; message: string } {
  const mode = typeof args.mode === 'string' ? args.mode.trim() : '';
  if (!STREAM_TEXT_MODES.has(mode)) {
    return {
      valid: false,
      message:
        'Tham số mode không hợp lệ. Phải là một trong: replace, before, after, append, paragraphBefore, paragraphAfter.',
    };
  }

  const text = typeof args.text === 'string' ? args.text : '';
  if (!text || text.length === 0) {
    return {
      valid: false,
      message: 'Tham số text không được để trống khi gọi superdoc_stream_text.',
    };
  }

  if (/[\r\n]/.test(text)) {
    return {
      valid: false,
      message:
        'Tham số text trong superdoc_stream_text không được chứa ký tự xuống dòng. Hãy gọi riêng từng đoạn văn một.',
    };
  }

  const rawAnchor = args.anchor;
  if (mode === 'append') {
    if (
      rawAnchor !== null &&
      rawAnchor !== undefined &&
      (typeof rawAnchor !== 'string' || rawAnchor.trim().length > 0)
    ) {
      return {
        valid: false,
        message: 'Với mode="append", tham số anchor phải là null.',
      };
    }
    return {
      valid: true,
      normalized: {
        mode: 'append',
        anchor: null,
        text,
      },
    };
  }

  if (typeof rawAnchor !== 'string' || !rawAnchor.trim()) {
    return {
      valid: false,
      message: `Với mode="${mode}", bắt buộc cung cấp anchor là đoạn văn bản gốc chính xác duy nhất cần nhắm tới.`,
    };
  }

  return {
    valid: true,
    normalized: {
      mode: mode as SuperDocStreamTextMode,
      anchor: rawAnchor,
      text,
    },
  };
}

interface StreamQueryMatchItem {
  address?: unknown;
  target?: {
    coordinateSpace?: string;
    start: { blockId: string; offset: number; [key: string]: unknown };
    end: { blockId: string; offset: number; [key: string]: unknown };
    [key: string]: unknown;
  };
}

interface StreamDocumentHandleLike {
  blocks: {
    list: (input: { offset: number; limit: number }) => Promise<{ revision?: string }> | { revision?: string };
  };
  query: {
    match: (input: {
      select: { type: 'text'; pattern: string; caseSensitive: boolean };
      require: 'exactlyOne';
    }) => Promise<{ items?: StreamQueryMatchItem[] }> | { items?: StreamQueryMatchItem[] };
  };
  create: {
    paragraph: (
      input: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  };
  replace: (
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  insert: (
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

function assertStreamReceiptOk(raw: Record<string, unknown> | undefined) {
  const receipt =
    raw && typeof raw.receipt === 'object' && raw.receipt !== null
      ? (raw.receipt as Record<string, unknown>)
      : raw;
  if (!receipt || receipt.success !== true) {
    const failure =
      typeof receipt?.failure === 'object' && receipt.failure !== null
        ? (receipt.failure as Record<string, unknown>)
        : undefined;
    const msg =
      (typeof failure?.message === 'string' && failure.message) ||
      (typeof receipt?.error === 'string' && receipt.error) ||
      'Không thể thực thi superdoc_stream_text trên tài liệu.';
    throw new Error(msg);
  }
  return receipt;
}

export async function commitServerTextStream(
  handle: unknown,
  args: ValidatedStreamTextArgs,
  changeMode: 'tracked' | 'direct',
): Promise<Record<string, unknown>> {
  const doc = handle as StreamDocumentHandleLike;
  let result: Record<string, unknown>;

  if (
    args.mode === 'append' ||
    args.mode === 'paragraphBefore' ||
    args.mode === 'paragraphAfter'
  ) {
    let at: Record<string, unknown> = { kind: 'documentEnd' };
    let expectedRevision: string | undefined;

    if (args.mode !== 'append') {
      const blocksRes = await doc.blocks.list({ offset: 0, limit: 1 });
      const revision = blocksRes?.revision;
      if (typeof revision !== 'string' || revision === 'unknown') {
        throw new Error('Phiên bản revision hiện tại của tài liệu chưa sẵn sàng.');
      }

      const matches = await doc.query.match({
        select: { type: 'text', pattern: args.anchor!, caseSensitive: true },
        require: 'exactlyOne',
      });
      const item = matches?.items?.[0];
      if (matches?.items?.length !== 1 || !item?.address) {
        throw new Error(
          'Anchor cho superdoc_stream_text phải khớp duy nhất một đoạn văn. Hãy dùng superdoc_inspect để đọc lại nội dung chính xác.',
        );
      }

      at = {
        kind: args.mode === 'paragraphBefore' ? 'before' : 'after',
        target: item.address,
      };
      expectedRevision = revision;
    }

    result = await doc.create.paragraph(
      {
        text: args.text,
        at,
        changeMode,
        ...(expectedRevision ? { expectedRevision } : {}),
      },
      {
        changeMode,
        ...(expectedRevision ? { expectedRevision } : {}),
      },
    );
  } else {
    const blocksRes = await doc.blocks.list({ offset: 0, limit: 1 });
    const revision = blocksRes?.revision;
    if (typeof revision !== 'string' || revision === 'unknown') {
      throw new Error('Phiên bản revision hiện tại của tài liệu chưa sẵn sàng.');
    }

    const matches = await doc.query.match({
      select: { type: 'text', pattern: args.anchor!, caseSensitive: true },
      require: 'exactlyOne',
    });
    const item = matches?.items?.[0];
    if (
      matches?.items?.length !== 1 ||
      !item?.target ||
      item.target.start.blockId !== item.target.end.blockId
    ) {
      throw new Error(
        'Anchor cho superdoc_stream_text phải khớp chính xác một đoạn nằm trong cùng một paragraph. Hãy kiểm tra lại bằng superdoc_inspect.',
      );
    }

    let target: Record<string, unknown> = {
      ...item.target,
      coordinateSpace: 'visible',
    };
    const options = { changeMode, expectedRevision: revision };

    if (args.mode === 'replace') {
      result = await doc.replace(
        { target, text: args.text, ...options },
        options,
      );
    } else {
      const point =
        args.mode === 'before' ? item.target.start : item.target.end;
      target = { ...target, start: point, end: point };
      result = await doc.insert(
        { target, value: args.text, type: 'text', ...options },
        options,
      );
    }
  }

  const receipt = assertStreamReceiptOk(result);
  const postRevision =
    typeof receipt.revision === 'string'
      ? receipt.revision
      : typeof result.revision === 'string'
        ? result.revision
        : undefined;

  return {
    status: 'ok',
    success: true,
    streamed: true,
    mode: args.mode,
    characters: args.text.length,
    changeMode,
    ...(postRevision ? { postSnapshot: { revision: postRevision } } : {}),
  };
}
