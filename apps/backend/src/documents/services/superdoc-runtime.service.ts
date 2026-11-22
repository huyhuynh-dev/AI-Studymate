import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  SuperDocClient,
  createAgentToolkit,
  getActionDispositions,
  type AgentToolkit,
  type SuperDocDocument,
} from '@superdoc/sdk';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { StorageService } from '../../storage/storage.service.js';
import { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import {
  DOCX_MIME_TYPE,
  isDocxDocument,
} from '../constants/editable-document.constants.js';

export type SuperDocAgentChangeMode = 'tracked' | 'direct';

export const ADVERTISED_SUPERDOC_TOOLS: ReadonlySet<string> = new Set([
  'superdoc_inspect',
  'superdoc_perform_action',
]);

const MUTATING_SUPERDOC_TOOLS: ReadonlySet<string> = new Set([
  'superdoc_perform_action',
]);

const ALLOWED_DIRECT_ACTIONS_IN_TRACKED_MODE = [
  'add_comments',
  'comment_paragraphs',
  'reply_to_comment',
  'resolve_comments',
] as const;

const ALLOWED_DIRECT_ACTIONS_SET: ReadonlySet<string> = new Set(
  ALLOWED_DIRECT_ACTIONS_IN_TRACKED_MODE,
);

const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

interface WorkingSnapshotEntry {
  filePath: string;
  fileName: string;
  mimeType: string;
  updatedAt: number;
  hasUnpersistedChanges: boolean;
  revision?: string;
}

export interface SuperDocAgentSessionContext {
  doc: SuperDocDocument;
  toolkit: AgentToolkit;
  documentId: string;
  fileName: string;
  changeMode: SuperDocAgentChangeMode;
  markMutated: (revision?: string) => void;
}

export interface SuperDocReceiptLike {
  status?: string;
  intent?: string;
  changeMode?: string;
  verificationPassed?: boolean;
  preSnapshot?: { revision?: string };
  postSnapshot?: { revision?: string };
  errors?: Array<{ code?: string; message?: string }>;
  error?: { code?: string; message?: string };
}

export function asSuperDocReceipt(value: unknown): SuperDocReceiptLike {
  return typeof value === 'object' && value !== null
    ? (value as SuperDocReceiptLike)
    : {};
}

export function didSuperDocReceiptMutate(
  receipt: SuperDocReceiptLike,
  args: Record<string, unknown>,
): boolean {
  const before = receipt.preSnapshot?.revision;
  const after = receipt.postSnapshot?.revision;
  if (before != null && after != null) {
    return before !== after;
  }
  return args.dryRun !== true && receipt.status !== 'aborted';
}

export function extractSuperDocSdkError(error: unknown): {
  code: string;
  message: string;
} {
  if (typeof error === 'object' && error !== null) {
    const errObj = error as { code?: unknown; message?: unknown };
    return {
      code: typeof errObj.code === 'string' ? errObj.code : 'SUPERDOC_ERROR',
      message:
        typeof errObj.message === 'string'
          ? errObj.message
          : 'Không thể thực thi thao tác trên tài liệu SuperDoc.',
    };
  }
  return {
    code: 'SUPERDOC_ERROR',
    message:
      typeof error === 'string' && error.trim()
        ? error
        : 'Lỗi không xác định từ SuperDoc SDK.',
  };
}

@Injectable()
export class SuperDocRuntimeService implements OnModuleDestroy {
  private readonly logger = new Logger(SuperDocRuntimeService.name);
  private readonly snapshotRoot = path.join(
    os.tmpdir(),
    'studymate-superdoc-snapshots',
  );
  private readonly snapshots = new Map<string, WorkingSnapshotEntry>();
  private readonly keyQueues = new Map<string, Promise<unknown>>();
  private readonly trackedCapableActions: ReadonlySet<string>;

  private clientPromise: Promise<SuperDocClient> | null = null;
  private toolkitCache: Record<SuperDocAgentChangeMode, Promise<AgentToolkit> | null> = {
    tracked: null,
    direct: null,
  };

  constructor(
    private readonly storageService: StorageService,
    private readonly documentsRepo: DocumentsRepoService,
  ) {
    const dispositions = getActionDispositions();
    this.trackedCapableActions = new Set(
      Object.entries(dispositions)
        .filter(([, disposition]) => disposition === 'tracked')
        .map(([action]) => action),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.dispose();
  }

  async dispose(): Promise<void> {
    const pathsToDelete = Array.from(this.snapshots.values()).map(
      (entry) => entry.filePath,
    );
    this.snapshots.clear();

    await Promise.all(
      pathsToDelete.map((filePath) =>
        fs.rm(filePath, { force: true }).catch(() => undefined),
      ),
    );

    if (this.clientPromise) {
      try {
        const client = await this.clientPromise;
        await client.dispose();
      } catch (error) {
        this.logger.warn(
          `Không thể đóng SuperDocClient sạch sẽ: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        this.clientPromise = null;
      }
    }
  }

  private getSessionKey(userId: string, documentId: string): string {
    return `${userId}:${documentId}`;
  }

  private async getClient(): Promise<SuperDocClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = new SuperDocClient({
          runtime: 'v2',
          startupTimeoutMs: 25_000,
          requestTimeoutMs: 60_000,
          watchdogTimeoutMs: 180_000,
          defaultChangeMode: 'tracked',
          user: {
            name: 'StudyMate AI',
            email: 'ai-agent@studymate.local',
          },
        });
        await client.connect();
        this.logger.log('SuperDocClient (v2) đã kết nối thành công.');
        return client;
      })().catch((error) => {
        this.clientPromise = null;
        throw error;
      });
    }
    return this.clientPromise;
  }

  async getToolkit(
    changeMode: SuperDocAgentChangeMode = 'tracked',
  ): Promise<AgentToolkit> {
    const cached = this.toolkitCache[changeMode];
    if (cached) {
      return cached;
    }

    const promise = createAgentToolkit({
      provider: 'vercel',
      preset: 'core',
      ...(changeMode === 'tracked'
        ? {
            enforceChangeMode: 'tracked',
            allowDirectActions: [...ALLOWED_DIRECT_ACTIONS_IN_TRACKED_MODE],
          }
        : {}),
    }).catch((error) => {
      this.toolkitCache[changeMode] = null;
      throw error;
    });

    this.toolkitCache[changeMode] = promise;
    return promise;
  }

  /**
   * Đọc thông tin và xác thực tài liệu DOCX thuộc quyền sở hữu của người dùng.
   */
  async assertOwnedDocxDocument(userId: string, documentId: string) {
    const doc = await this.documentsRepo.getDocumentById(documentId, userId);
    if (!doc) {
      throw new NotFoundException(
        'Không tìm thấy tài liệu hoặc bạn không có quyền truy cập.',
      );
    }
    if (!isDocxDocument(doc.mime_type, doc.file_name)) {
      throw new BadRequestException(
        'SuperDoc AI Agent chỉ hỗ trợ chỉnh sửa trực tiếp định dạng Word (.docx) hoặc tài liệu nhập từ Google Docs.',
      );
    }
    return doc;
  }

  private async ensureSnapshotDir(): Promise<void> {
    await fs.mkdir(this.snapshotRoot, { recursive: true });
  }

  private async pruneExpiredSnapshots(): Promise<void> {
    const cutoff = Date.now() - SNAPSHOT_TTL_MS;
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.snapshots.entries()) {
      if (entry.updatedAt < cutoff) {
        expiredKeys.push(key);
        await fs.rm(entry.filePath, { force: true }).catch(() => undefined);
      }
    }

    for (const key of expiredKeys) {
      this.snapshots.delete(key);
    }
  }

  private enqueueForKey<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.keyQueues.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.keyQueues.set(key, settled);
    void settled.then(() => {
      if (this.keyQueues.get(key) === settled) {
        this.keyQueues.delete(key);
      }
    });
    return run;
  }

  /**
   * Nhận bản nháp DOCX từ trình duyệt (khi có chỉnh sửa thủ công chưa lưu)
   * trước khi AI Agent bắt đầu phiên làm việc.
   */
  async stageClientWorkingSnapshot(
    userId: string,
    documentId: string,
    buffer: Buffer,
  ): Promise<{ staged: true; byteLength: number; updatedAt: string }> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Tệp nháp DOCX trống, không thể đồng bộ.');
    }
    const docRecord = await this.assertOwnedDocxDocument(userId, documentId);
    const key = this.getSessionKey(userId, documentId);

    return this.enqueueForKey(key, async () => {
      await this.ensureSnapshotDir();
      await this.pruneExpiredSnapshots();

      const nextPath = path.join(
        this.snapshotRoot,
        `${documentId}-${randomUUID()}.docx`,
      );
      await fs.writeFile(nextPath, buffer);

      const previous = this.snapshots.get(key);
      const updatedAt = Date.now();
      this.snapshots.set(key, {
        filePath: nextPath,
        fileName: docRecord.file_name,
        mimeType: DOCX_MIME_TYPE,
        updatedAt,
        hasUnpersistedChanges: false,
      });

      if (previous && previous.filePath !== nextPath) {
        await fs.rm(previous.filePath, { force: true }).catch(() => undefined);
      }

      return {
        staged: true as const,
        byteLength: buffer.length,
        updatedAt: new Date(updatedAt).toISOString(),
      };
    });
  }

  /**
   * Lấy buffer DOCX mới nhất (ưu tiên working snapshot có đề xuất AI, fallback R2).
   */
  async getWorkingSnapshotBuffer(
    userId: string,
    documentId: string,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    updatedAt: string;
    hasUnpersistedChanges: boolean;
  }> {
    const docRecord = await this.assertOwnedDocxDocument(userId, documentId);
    const key = this.getSessionKey(userId, documentId);

    return this.enqueueForKey(key, async () => {
      const existing = this.snapshots.get(key);
      if (existing) {
        try {
          const buffer = await fs.readFile(existing.filePath);
          return {
            buffer,
            fileName: existing.fileName,
            mimeType: existing.mimeType,
            updatedAt: new Date(existing.updatedAt).toISOString(),
            hasUnpersistedChanges: existing.hasUnpersistedChanges,
          };
        } catch {
          this.snapshots.delete(key);
        }
      }

      const r2Buffer = await this.storageService.getObjectBuffer(
        docRecord.storage_key,
      );
      return {
        buffer: r2Buffer,
        fileName: docRecord.file_name,
        mimeType: DOCX_MIME_TYPE,
        updatedAt: new Date().toISOString(),
        hasUnpersistedChanges: false,
      };
    });
  }

  async clearWorkingSnapshot(
    userId: string,
    documentId: string,
  ): Promise<void> {
    const key = this.getSessionKey(userId, documentId);
    await this.enqueueForKey(key, async () => {
      const existing = this.snapshots.get(key);
      if (!existing) return;
      this.snapshots.delete(key);
      await fs.rm(existing.filePath, { force: true }).catch(() => undefined);
    });
  }

  /**
   * Xác thực an toàn đầu vào trước khi gửi sang toolkit.dispatch.
   */
  validateToolCallPolicy(
    toolName: string,
    args: Record<string, unknown>,
    changeMode: SuperDocAgentChangeMode,
  ): { allowed: true; normalizedArgs: Record<string, unknown> } | {
    allowed: false;
    code: string;
    message: string;
  } {
    if (!ADVERTISED_SUPERDOC_TOOLS.has(toolName)) {
      return {
        allowed: false,
        code: 'TOOL_NOT_ADVERTISED',
        message: `"${toolName}" không nằm trong danh sách công cụ được cấp phép.`,
      };
    }

    if (!MUTATING_SUPERDOC_TOOLS.has(toolName)) {
      return { allowed: true, normalizedArgs: args };
    }

    const action = typeof args.action === 'string' ? args.action.trim() : '';
    if (!action) {
      return {
        allowed: false,
        code: 'INVALID_ARGUMENT',
        message: 'Thiếu tên hành động (action) cho superdoc_perform_action.',
      };
    }

    if (changeMode === 'tracked') {
      if (ALLOWED_DIRECT_ACTIONS_SET.has(action)) {
        return {
          allowed: true,
          normalizedArgs: { ...args, changeMode: 'direct' },
        };
      }

      if (!this.trackedCapableActions.has(action)) {
        return {
          allowed: false,
          code: 'CHANGE_MODE_REQUIRED',
          message: `Hành động "${action}" không hỗ trợ chế độ Đề xuất (tracked change). Hãy chọn hành động hỗ trợ tracked change hoặc chuyển sang chế độ chỉnh sửa trực tiếp.`,
        };
      }

      return {
        allowed: true,
        normalizedArgs: { ...args, changeMode: 'tracked' },
      };
    }

    return {
      allowed: true,
      normalizedArgs: {
        ...args,
        changeMode: args.changeMode === 'tracked' ? 'tracked' : 'direct',
      },
    };
  }

  /**
   * Mở một phiên tài liệu độc lập trên SuperDocClient, chạy chuỗi thao tác của Agent
   * và lưu kết quả sang file working snapshot mới nếu có thay đổi.
   */
  async runWithDocumentSession<T>(params: {
    userId: string;
    documentId: string;
    changeMode: SuperDocAgentChangeMode;
    fn: (session: SuperDocAgentSessionContext) => Promise<T>;
  }): Promise<T & { mutated: boolean; latestRevision?: string }> {
    const docRecord = await this.assertOwnedDocxDocument(
      params.userId,
      params.documentId,
    );
    const key = this.getSessionKey(params.userId, params.documentId);

    return this.enqueueForKey(key, async () => {
      await this.ensureSnapshotDir();
      await this.pruneExpiredSnapshots();

      let inputPath = this.snapshots.get(key)?.filePath;
      let inputExists = false;
      if (inputPath) {
        try {
          await fs.access(inputPath);
          inputExists = true;
        } catch {
          inputExists = false;
        }
      }

      if (!inputPath || !inputExists) {
        const sourceBuffer = await this.storageService.getObjectBuffer(
          docRecord.storage_key,
        );
        inputPath = path.join(
          this.snapshotRoot,
          `${params.documentId}-${randomUUID()}.docx`,
        );
        await fs.writeFile(inputPath, sourceBuffer);
        this.snapshots.set(key, {
          filePath: inputPath,
          fileName: docRecord.file_name,
          mimeType: DOCX_MIME_TYPE,
          updatedAt: Date.now(),
          hasUnpersistedChanges: false,
        });
      }

      const [client, toolkit] = await Promise.all([
        this.getClient(),
        this.getToolkit(params.changeMode),
      ]);

      const doc = await client.open({ doc: inputPath });
      let mutated = false;
      let latestRevision: string | undefined;

      try {
        const result = await params.fn({
          doc,
          toolkit,
          documentId: params.documentId,
          fileName: docRecord.file_name,
          changeMode: params.changeMode,
          markMutated: (revision?: string) => {
            mutated = true;
            if (revision) {
              latestRevision = revision;
            }
          },
        });

        if (mutated) {
          const outputPath = path.join(
            this.snapshotRoot,
            `${params.documentId}-${randomUUID()}.docx`,
          );
          await doc.save({ out: outputPath, force: true });

          const previousEntry = this.snapshots.get(key);
          this.snapshots.set(key, {
            filePath: outputPath,
            fileName: docRecord.file_name,
            mimeType: DOCX_MIME_TYPE,
            updatedAt: Date.now(),
            hasUnpersistedChanges: true,
            revision: latestRevision,
          });

          if (previousEntry && previousEntry.filePath !== outputPath) {
            await fs
              .rm(previousEntry.filePath, { force: true })
              .catch(() => undefined);
          }
        }

        return {
          ...result,
          mutated,
          latestRevision,
        };
      } finally {
        await doc.close({ discard: true }).catch(() => undefined);
      }
    });
  }
}
