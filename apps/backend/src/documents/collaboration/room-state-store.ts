import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface PersistedRoomMeta {
  documentId: string;
  seededVersion: number;
  hasUnsavedRoomEdits: boolean;
  updatedAt: number;
}

/**
 * Lưu trữ bền vững trạng thái Yjs (.yjs) và metadata phiên bản (.meta.json) của từng room cộng tác
 * bằng thao tác ghi nguyên tử (temp + rename) để chống hỏng dữ liệu khi mất kết nối/restart.
 */
export class FileCollaborationRoomStore {
  private dirReadyPromise: Promise<void> | null = null;
  private writeSeq = 0;

  constructor(private readonly directory: string) {}

  private ensureDir(): Promise<void> {
    if (!this.dirReadyPromise) {
      this.dirReadyPromise = fs
        .mkdir(this.directory, { recursive: true })
        .then(() => undefined);
    }
    return this.dirReadyPromise;
  }

  private hashRoomKey(roomName: string): string {
    return createHash('sha256').update(roomName).digest('hex');
  }

  private stateFilePath(roomName: string): string {
    return path.join(this.directory, `${this.hashRoomKey(roomName)}.yjs`);
  }

  private metaFilePath(documentId: string): string {
    return path.join(
      this.directory,
      `${this.hashRoomKey(`meta:${documentId}`)}.meta.json`,
    );
  }

  async loadRoomState(roomName: string): Promise<Uint8Array | null> {
    try {
      const data = await fs.readFile(this.stateFilePath(roomName));
      return new Uint8Array(data);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 'ENOENT') return null;
      throw error;
    }
  }

  async storeRoomState(roomName: string, state: Uint8Array): Promise<void> {
    await this.ensureDir();
    const target = this.stateFilePath(roomName);
    const tmp = `${target}.${process.pid}.${++this.writeSeq}.tmp`;
    await fs.writeFile(tmp, state);
    await fs.rename(tmp, target);
  }

  async deleteRoomState(roomName: string): Promise<void> {
    await fs.rm(this.stateFilePath(roomName), { force: true });
  }

  async loadRoomMeta(documentId: string): Promise<PersistedRoomMeta | null> {
    try {
      const raw = await fs.readFile(this.metaFilePath(documentId), 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedRoomMeta>;
      if (
        typeof parsed.documentId === 'string' &&
        typeof parsed.seededVersion === 'number'
      ) {
        return {
          documentId: parsed.documentId,
          seededVersion: parsed.seededVersion,
          hasUnsavedRoomEdits: Boolean(parsed.hasUnsavedRoomEdits),
          updatedAt:
            typeof parsed.updatedAt === 'number'
              ? parsed.updatedAt
              : Date.now(),
        };
      }
      return null;
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 'ENOENT') return null;
      throw error;
    }
  }

  async storeRoomMeta(meta: PersistedRoomMeta): Promise<void> {
    await this.ensureDir();
    const target = this.metaFilePath(meta.documentId);
    const tmp = `${target}.${process.pid}.${++this.writeSeq}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(meta), 'utf8');
    await fs.rename(tmp, target);
  }

  async deleteRoomMeta(documentId: string): Promise<void> {
    await fs.rm(this.metaFilePath(documentId), { force: true });
  }
}
