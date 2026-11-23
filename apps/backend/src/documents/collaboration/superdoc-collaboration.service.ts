import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Hocuspocus } from '@hocuspocus/server';
import { SuperDocClient, type SuperDocDocument } from '@superdoc/sdk';
import { WebSocketServer, type WebSocket } from 'ws';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { isDocxDocument } from '../constants/editable-document.constants.js';
import {
  authorizeCollaborationAccess,
  documentIdFromRoomName,
  resolveCollaborationSecret,
  signCollaborationToken,
} from './collaboration-token.helper.js';
import { FileCollaborationRoomStore } from './room-state-store.js';

const AGENT_SERVICE_USER_ID = 'studymate-agent-service@studymate.local';
const ROOM_IDLE_TTL_MS = 20 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000;
const USER_COLLAB_TOKEN_TTL_SECONDS = 3600;
const SERVICE_TOKEN_EXPIRY_SECONDS = 253_402_300_799;

interface ActiveCollaborationRoom {
  documentId: string;
  userId: string;
  handle: SuperDocDocument | null;
  tempFilePath: string;
  seededVersion: number;
  hasUnsavedRoomEdits: boolean;
  isSeeding: boolean;
  activeAgentJobs: number;
  lastActivityAt: number;
}

export interface BrowserCollaborationSessionInfo {
  enabled: boolean;
  documentId: string;
  collaborationUrl: string;
  token: string;
  expiresAt: string;
  contentVersion: number;
  hasUnsavedRoomEdits: boolean;
}

function isRoomAlreadyExistsError(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === 'object') {
    const record = current as {
      code?: unknown;
      name?: unknown;
      cause?: unknown;
      message?: unknown;
    };
    if (
      record.code === 'COLLABORATION_ROOM_ALREADY_EXISTS' ||
      record.name === 'RoomExistsError' ||
      (typeof record.message === 'string' &&
        record.message.includes('COLLABORATION_ROOM_ALREADY_EXISTS'))
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

@Injectable()
export class SuperDocCollaborationService implements OnModuleDestroy {
  private readonly logger = new Logger(SuperDocCollaborationService.name);
  private readonly secret = resolveCollaborationSecret();
  private readonly roomRoot = path.join(os.tmpdir(), 'studymate-superdoc-rooms');
  private readonly roomStore = new FileCollaborationRoomStore(
    path.join(this.roomRoot, 'yjs-states'),
  );

  private readonly rooms = new Map<string, ActiveCollaborationRoom>();
  private readonly roomNames = new Map<string, string>();
  private readonly docQueues = new Map<string, Promise<unknown>>();
  private readonly serviceSocketIds = new Set<string>();

  private readonly hocuspocus: Hocuspocus;
  private wsServer: WebSocketServer | null = null;
  private internalPort: number | null = null;
  private clientPromise: Promise<SuperDocClient> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private upgradeHandler:
    | ((req: IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;
  private attachedServer: HttpServer | null = null;

  constructor(
    private readonly storageService: StorageService,
    private readonly documentsRepo: DocumentsRepoService,
  ) {
    this.hocuspocus = new Hocuspocus({
      quiet: true,
      debounce: 1500,
      maxDebounce: 8000,
      onAuthenticate: async ({ token, documentName, connection }) => {
        const access = authorizeCollaborationAccess(this.secret, {
          token,
          documentName,
        });
        if (!access) {
          throw new Error('Không có quyền truy cập phòng cộng tác SuperDoc.');
        }
        if (access.readOnly) {
          connection.readOnly = true;
        }
        return { userId: access.userId, documentId: access.documentId };
      },
      onConnect: async (context) => {
        const docId = documentIdFromRoomName(context.documentName);
        if (docId) {
          this.roomNames.set(docId, context.documentName);
        }
        const ctxUserId = (context.context as { userId?: unknown } | undefined)
          ?.userId;
        if (ctxUserId === AGENT_SERVICE_USER_ID) {
          this.serviceSocketIds.add(context.socketId);
        }
      },
      onLoadDocument: async ({ documentName, document }) => {
        const docId = documentIdFromRoomName(documentName);
        if (docId) {
          this.roomNames.set(docId, documentName);
        }
        const saved = await this.roomStore.loadRoomState(documentName);
        if (saved && saved.byteLength > 0) {
          applyUpdate(document, saved);
        }
        return document;
      },
      onStoreDocument: async ({ documentName, document }) => {
        await this.roomStore.storeRoomState(
          documentName,
          encodeStateAsUpdate(document),
        );
      },
      onChange: async ({ documentName }) => {
        const docId = documentIdFromRoomName(documentName);
        if (!docId) return;
        const room = this.rooms.get(docId);
        if (!room) return;
        room.lastActivityAt = Date.now();
        if (!room.isSeeding && !room.hasUnsavedRoomEdits) {
          room.hasUnsavedRoomEdits = true;
          await this.roomStore
            .storeRoomMeta({
              documentId: docId,
              seededVersion: room.seededVersion,
              hasUnsavedRoomEdits: true,
              updatedAt: room.lastActivityAt,
            })
            .catch((err) => {
              this.logger.warn(
                `Không thể cập nhật metadata phòng [${docId}]: ${err instanceof Error ? err.message : String(err)}`,
              );
            });
        }
      },
      onDisconnect: async (context) => {
        this.serviceSocketIds.delete(context.socketId);
      },
    });
  }

  isEnabled(): boolean {
    return this.internalPort !== null;
  }

  /**
   * Gắn WebSocketServer (`noServer: true`) vào HTTP server hiện có của NestJS tại path `/collaboration`.
   * Không ảnh hưởng đến các REST routes, SSE hay các endpoint khác của Express.
   */
  attachHttpServer(server: HttpServer, port: number): void {
    if (this.attachedServer === server) {
      this.internalPort = port;
      return;
    }

    this.internalPort = port;
    this.attachedServer = server;
    this.wsServer = new WebSocketServer({ noServer: true });

    this.upgradeHandler = (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
    ) => {
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (
          url.pathname !== '/collaboration' &&
          !url.pathname.startsWith('/collaboration/')
        ) {
          return;
        }
      } catch {
        return;
      }

      this.wsServer?.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        const originalUrl = request.url;
        request.url = originalUrl?.replace(/^\/collaboration/, '') || '/';
        this.hocuspocus.handleConnection(ws, request);
        request.url = originalUrl;
      });
    };

    server.on('upgrade', this.upgradeHandler);

    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        void this.expireIdleRooms().catch((err) => {
          this.logger.warn(
            `Lỗi khi dọn dẹp phòng cộng tác hết hạn: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }, ROOM_CLEANUP_INTERVAL_MS);
      this.cleanupTimer.unref();
    }

    this.logger.log(
      `Hocuspocus SuperDoc Collaboration đã khởi chạy trên ws://127.0.0.1:${port}/collaboration`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.dispose();
  }

  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.attachedServer && this.upgradeHandler) {
      this.attachedServer.off('upgrade', this.upgradeHandler);
      this.upgradeHandler = null;
      this.attachedServer = null;
    }

    const activeRooms = Array.from(this.rooms.values());
    this.rooms.clear();

    await Promise.all(
      activeRooms.map((room) => this.closeRoomResources(room, false)),
    );

    if (this.clientPromise) {
      try {
        const client = await this.clientPromise;
        await client.dispose();
      } catch (err) {
        this.logger.warn(
          `Không thể đóng SuperDocClient cộng tác sạch sẽ: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        this.clientPromise = null;
      }
    }

    this.hocuspocus.closeConnections();
    await this.hocuspocus.destroy().catch(() => undefined);

    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer?.close(() => resolve());
      });
      this.wsServer = null;
    }

    this.internalPort = null;
  }

  private enqueueForDocument<T>(
    documentId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.docQueues.get(documentId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.docQueues.set(documentId, settled);
    void settled.then(() => {
      if (this.docQueues.get(documentId) === settled) {
        this.docQueues.delete(documentId);
      }
    });
    return run;
  }

  private async getClient(): Promise<SuperDocClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = new SuperDocClient({
          runtime: 'v2',
          startupTimeoutMs: 30_000,
          requestTimeoutMs: 60_000,
          watchdogTimeoutMs: 180_000,
          defaultChangeMode: 'tracked',
          user: {
            name: 'StudyMate AI',
            email: AGENT_SERVICE_USER_ID,
          },
        });
        await client.connect();
        return client;
      })().catch((err) => {
        this.clientPromise = null;
        throw err;
      });
    }
    return this.clientPromise;
  }

  private createUserToken(
    userId: string,
    documentId: string,
    readOnly = false,
  ): { token: string; expiresAt: string } {
    const expSeconds = Math.floor(Date.now() / 1000) + USER_COLLAB_TOKEN_TTL_SECONDS;
    const token = signCollaborationToken(this.secret, {
      sub: userId,
      documents: [documentId],
      readOnly,
      exp: expSeconds,
    });
    return {
      token,
      expiresAt: new Date(expSeconds * 1000).toISOString(),
    };
  }

  private createServiceToken(documentId: string): string {
    return signCollaborationToken(this.secret, {
      sub: AGENT_SERVICE_USER_ID,
      documents: [documentId],
      readOnly: false,
      exp: SERVICE_TOKEN_EXPIRY_SECONDS,
    });
  }

  private resolvePublicWsUrl(requestHost?: string, requestProto?: string): string {
    const configuredWs = process.env.COLLABORATION_PUBLIC_WS_URL?.trim();
    if (configuredWs) {
      return configuredWs.replace(/\/+$/, '');
    }

    const configuredHttp = process.env.BACKEND_PUBLIC_URL?.trim();
    if (configuredHttp) {
      return `${configuredHttp.replace(/^http/, 'ws').replace(/\/+$/, '')}/collaboration`;
    }

    if (requestHost) {
      const wsProto = requestProto === 'https' ? 'wss' : 'ws';
      return `${wsProto}://${requestHost}/collaboration`;
    }

    return `ws://localhost:${this.internalPort ?? process.env.PORT ?? 3001}/collaboration`;
  }

  private async assertOwnedDocxDocument(userId: string, documentId: string) {
    const doc = await this.documentsRepo.getDocumentById(documentId, userId);
    if (!doc) {
      throw new NotFoundException(
        'Không tìm thấy tài liệu hoặc bạn không có quyền truy cập.',
      );
    }
    if (!isDocxDocument(doc.mime_type, doc.file_name)) {
      throw new BadRequestException(
        'Phòng cộng tác SuperDoc chỉ hỗ trợ tài liệu Word (.docx).',
      );
    }
    return doc;
  }

  private async openSdkCollabHandle(params: {
    documentId: string;
    tempFilePath: string;
    roomMode: 'create' | 'join';
  }): Promise<SuperDocDocument> {
    if (!this.internalPort) {
      throw new Error('Hocuspocus collaboration server chưa sẵn sàng.');
    }
    const client = await this.getClient();
    const serviceToken = this.createServiceToken(params.documentId);
    return client.open(
      {
        doc: params.tempFilePath,
        collaboration: {
          providerType: 'hocuspocus',
          url: `ws://127.0.0.1:${this.internalPort}/collaboration`,
          documentId: params.documentId,
          roomMode: params.roomMode,
          syncTimeoutMs: 90_000,
          presence: {
            name: 'StudyMate AI',
            userId: AGENT_SERVICE_USER_ID,
            color: '#4F46E5',
          },
        },
      },
      {
        timeoutMs: 90_000,
        collaborationAuth: {
          type: 'token',
          token: serviceToken,
        },
      },
    );
  }

  private async closeRoomResources(
    room: ActiveCollaborationRoom,
    deletePersistedState: boolean,
  ): Promise<void> {
    await room.handle?.close({ discard: true }).catch(() => undefined);
    await fs.rm(room.tempFilePath, { force: true }).catch(() => undefined);

    const roomName =
      Array.from(this.hocuspocus.documents.keys()).find(
        (candidate) => documentIdFromRoomName(candidate) === room.documentId,
      ) ?? this.roomNames.get(room.documentId);

    if (roomName) {
      this.hocuspocus.closeConnections(roomName);
      const hpDoc = this.hocuspocus.documents.get(roomName);
      if (hpDoc) {
        await this.hocuspocus.unloadDocument(hpDoc).catch(() => undefined);
      }
      if (deletePersistedState) {
        await this.roomStore.deleteRoomState(roomName).catch(() => undefined);
        this.roomNames.delete(room.documentId);
      }
    }

    if (deletePersistedState) {
      await this.roomStore.deleteRoomMeta(room.documentId).catch(() => undefined);
    }
  }

  private async ensureRoomReadyUnlocked(
    userId: string,
    documentId: string,
    options?: { reset?: boolean },
  ): Promise<ActiveCollaborationRoom> {
    if (!this.internalPort) {
      throw new Error('Hocuspocus collaboration server chưa được gắn vào HTTP server.');
    }

    const docRecord = await this.assertOwnedDocxDocument(userId, documentId);
    const currentVersion = docRecord.content_version ?? 1;
    const persistedMeta = await this.roomStore.loadRoomMeta(documentId);

    const shouldReset =
      Boolean(options?.reset) ||
      (persistedMeta !== null && persistedMeta.seededVersion !== currentVersion);

    const existing = this.rooms.get(documentId);
    if (existing?.handle && !shouldReset) {
      existing.lastActivityAt = Date.now();
      return existing;
    }

    if (existing && (shouldReset || !existing.handle)) {
      this.rooms.delete(documentId);
      await this.closeRoomResources(existing, shouldReset);
    } else if (shouldReset) {
      const staleRoomName = this.roomNames.get(documentId);
      if (staleRoomName) {
        this.hocuspocus.closeConnections(staleRoomName);
        const hpDoc = this.hocuspocus.documents.get(staleRoomName);
        if (hpDoc) {
          await this.hocuspocus.unloadDocument(hpDoc).catch(() => undefined);
        }
        await this.roomStore.deleteRoomState(staleRoomName).catch(() => undefined);
      }
      await this.roomStore.deleteRoomMeta(documentId).catch(() => undefined);
    }

    await fs.mkdir(this.roomRoot, { recursive: true });
    const sourceBuffer = await this.storageService.getObjectBuffer(
      docRecord.storage_key,
    );
    const tempFilePath = path.join(
      this.roomRoot,
      `${documentId}-${randomUUID()}.docx`,
    );
    await fs.writeFile(tempFilePath, sourceBuffer);

    const effectiveMeta = shouldReset
      ? null
      : await this.roomStore.loadRoomMeta(documentId);

    const room: ActiveCollaborationRoom = {
      documentId,
      userId,
      handle: null,
      tempFilePath,
      seededVersion: currentVersion,
      hasUnsavedRoomEdits: effectiveMeta?.hasUnsavedRoomEdits ?? false,
      isSeeding: effectiveMeta === null,
      activeAgentJobs: 0,
      lastActivityAt: Date.now(),
    };
    this.rooms.set(documentId, room);

    try {
      let handle: SuperDocDocument;
      try {
        handle = await this.openSdkCollabHandle({
          documentId,
          tempFilePath,
          roomMode: 'create',
        });
      } catch (err) {
        if (!isRoomAlreadyExistsError(err)) {
          throw err;
        }
        room.isSeeding = false;
        handle = await this.openSdkCollabHandle({
          documentId,
          tempFilePath,
          roomMode: 'join',
        });
      }

      room.handle = handle;
      room.isSeeding = false;

      if (!effectiveMeta) {
        await this.roomStore.storeRoomMeta({
          documentId,
          seededVersion: currentVersion,
          hasUnsavedRoomEdits: false,
          updatedAt: Date.now(),
        });
      }

      return room;
    } catch (error) {
      this.rooms.delete(documentId);
      await fs.rm(tempFilePath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Khởi tạo hoặc kết nối lại phòng cộng tác Hocuspocus cho trình duyệt.
   */
  async createBrowserSession(
    userId: string,
    documentId: string,
    params?: { requestHost?: string; requestProto?: string; readOnly?: boolean },
  ): Promise<BrowserCollaborationSessionInfo> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        documentId,
        collaborationUrl: '',
        token: '',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        contentVersion: 1,
        hasUnsavedRoomEdits: false,
      };
    }

    const room = await this.enqueueForDocument(documentId, () =>
      this.ensureRoomReadyUnlocked(userId, documentId),
    );
    const { token, expiresAt } = this.createUserToken(
      userId,
      documentId,
      Boolean(params?.readOnly),
    );

    return {
      enabled: true,
      documentId,
      collaborationUrl: this.resolvePublicWsUrl(
        params?.requestHost,
        params?.requestProto,
      ),
      token,
      expiresAt,
      contentVersion: room.seededVersion,
      hasUnsavedRoomEdits: room.hasUnsavedRoomEdits,
    };
  }

  async refreshBrowserToken(
    userId: string,
    documentId: string,
    readOnly = false,
  ): Promise<{ token: string; expiresAt: string }> {
    await this.assertOwnedDocxDocument(userId, documentId);
    return this.createUserToken(userId, documentId, readOnly);
  }

  /**
   * Thực thi các thao tác AI Agent trực tiếp trên `SuperDocDocument` handle đang nối chung phòng Hocuspocus
   * với trình duyệt người dùng (có tuần tự hóa theo `documentId`).
   */
  async runWithCollaborativeDocument<T>(
    userId: string,
    documentId: string,
    fn: (handle: SuperDocDocument) => Promise<T>,
  ): Promise<T> {
    return this.enqueueForDocument(documentId, async () => {
      const room = await this.ensureRoomReadyUnlocked(userId, documentId);
      room.activeAgentJobs += 1;
      room.lastActivityAt = Date.now();
      try {
        if (!room.handle) {
          throw new Error('Phòng cộng tác SuperDoc chưa khởi tạo xong handle.');
        }
        return await fn(room.handle);
      } finally {
        room.activeAgentJobs = Math.max(0, room.activeAgentJobs - 1);
        room.lastActivityAt = Date.now();
      }
    });
  }

  /**
   * Cấp phát quyền ghi tuần tự độc quyền trên handle cộng tác trong suốt một lệnh
   * `superdoc_stream_text` (giữ khóa hàng đợi từ delta đầu tiên tới khi `commit()` hoàn tất).
   */
  async acquireStreamLease(
    userId: string,
    documentId: string,
  ): Promise<{ handle: SuperDocDocument; release: () => void }> {
    return new Promise<{ handle: SuperDocDocument; release: () => void }>(
      (resolveLease, rejectLease) => {
        void this.enqueueForDocument(documentId, async () => {
          let room: ActiveCollaborationRoom;
          try {
            room = await this.ensureRoomReadyUnlocked(userId, documentId);
            if (!room.handle) {
              throw new Error('Phòng cộng tác SuperDoc chưa khởi tạo xong handle.');
            }
          } catch (err) {
            rejectLease(err);
            return;
          }

          room.activeAgentJobs += 1;
          room.lastActivityAt = Date.now();
          let released = false;
          let resolveHold!: () => void;
          const holdPromise = new Promise<void>((res) => {
            resolveHold = res;
          });

          const release = () => {
            if (released) return;
            released = true;
            room.activeAgentJobs = Math.max(0, room.activeAgentJobs - 1);
            room.lastActivityAt = Date.now();
            resolveHold();
          };

          resolveLease({ handle: room.handle, release });
          await holdPromise;
        });
      },
    );
  }

  /**
   * Đồng bộ trạng thái metadata phòng sau khi người dùng bấm Lưu (`completeOverwrite`)
   * mà không ngắt kết nối trình soạn thảo đang mở.
   */
  async markRoomSaved(documentId: string, nextVersion: number): Promise<void> {
    await this.enqueueForDocument(documentId, async () => {
      const room = this.rooms.get(documentId);
      if (room) {
        room.seededVersion = nextVersion;
        room.hasUnsavedRoomEdits = false;
        room.lastActivityAt = Date.now();
      }
      await this.roomStore.storeRoomMeta({
        documentId,
        seededVersion: nextVersion,
        hasUnsavedRoomEdits: false,
        updatedAt: Date.now(),
      });
    });
  }

  /**
   * Hủy và dọn dẹp phòng cộng tác (dùng khi xóa tài liệu hoặc khi người dùng chọn Tải lại bản gốc R2).
   */
  async resetRoomForDocument(
    documentId: string,
    options?: { deleteState?: boolean },
  ): Promise<void> {
    const deleteState = options?.deleteState ?? true;
    await this.enqueueForDocument(documentId, async () => {
      const room = this.rooms.get(documentId);
      if (room) {
        this.rooms.delete(documentId);
        await this.closeRoomResources(room, deleteState);
        return;
      }

      const knownRoomName =
        Array.from(this.hocuspocus.documents.keys()).find(
          (candidate) => documentIdFromRoomName(candidate) === documentId,
        ) ?? this.roomNames.get(documentId);

      if (knownRoomName) {
        this.hocuspocus.closeConnections(knownRoomName);
        const hpDoc = this.hocuspocus.documents.get(knownRoomName);
        if (hpDoc) {
          await this.hocuspocus.unloadDocument(hpDoc).catch(() => undefined);
        }
        if (deleteState) {
          await this.roomStore.deleteRoomState(knownRoomName).catch(() => undefined);
          this.roomNames.delete(documentId);
        }
      }

      if (deleteState) {
        await this.roomStore.deleteRoomMeta(documentId).catch(() => undefined);
      }
    });
  }

  private async expireIdleRooms(): Promise<void> {
    const cutoff = Date.now() - ROOM_IDLE_TTL_MS;
    const candidates = Array.from(this.rooms.values()).filter(
      (room) => room.activeAgentJobs === 0 && room.lastActivityAt < cutoff,
    );

    for (const room of candidates) {
      const roomName =
        Array.from(this.hocuspocus.documents.keys()).find(
          (candidate) => documentIdFromRoomName(candidate) === room.documentId,
        ) ?? this.roomNames.get(room.documentId);
      const hpDoc = roomName ? this.hocuspocus.documents.get(roomName) : undefined;
      const browserClientCount = hpDoc
        ? Math.max(0, hpDoc.getConnectionsCount() - 1)
        : 0;

      if (browserClientCount > 0) {
        room.lastActivityAt = Date.now();
        continue;
      }

      await this.enqueueForDocument(room.documentId, async () => {
        const current = this.rooms.get(room.documentId);
        if (!current || current.activeAgentJobs > 0) return;
        this.rooms.delete(room.documentId);
        await this.closeRoomResources(current, false);
      });
    }
  }
}
