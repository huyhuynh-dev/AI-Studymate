import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DocumentAsset, Prisma } from '../../generated/prisma/client.js';

export interface CreateDocumentAssetInput {
  chunkId?: string | null;
  assetType: string;
  selfRef?: string | null;
  pageNo?: number | null;
  bbox?: Prisma.InputJsonValue | null;
  storageKey: string;
  caption?: string | null;
  vlmDescription?: string | null;
}

@Injectable()
export class DocumentAssetsRepoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAssetsByDocumentId(documentId: string): Promise<DocumentAsset[]> {
    return await this.prisma.documentAsset.findMany({
      where: { document_id: documentId },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Xóa toàn bộ assets cũ của document và lưu danh sách assets mới trong 1 transaction (idempotent).
   */
  async replaceDocumentAssets(
    documentId: string,
    assets: CreateDocumentAssetInput[],
  ): Promise<DocumentAsset[]> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.documentAsset.deleteMany({
        where: { document_id: documentId },
      });

      const created: DocumentAsset[] = [];
      for (const item of assets) {
        const asset = await tx.documentAsset.create({
          data: {
            document_id: documentId,
            chunk_id: item.chunkId ?? null,
            asset_type: item.assetType.slice(0, 50),
            self_ref: item.selfRef ? item.selfRef.slice(0, 100) : null,
            page_no: item.pageNo ?? null,
            bbox: item.bbox ?? Prisma.DbNull,
            storage_key: item.storageKey,
            caption: item.caption ?? null,
            vlm_description: item.vlmDescription ?? null,
          },
        });
        created.push(asset);
      }
      return created;
    });
  }

  /**
   * Liên kết chunk_id cho các bản ghi document_assets dựa trên self_ref (ví dụ "#/pictures/0").
   */
  async linkAssetsToChunksBySelfRef(
    documentId: string,
    selfRefToChunkId: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (selfRefToChunkId.size === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [selfRef, chunkId] of selfRefToChunkId.entries()) {
        await tx.documentAsset.updateMany({
          where: {
            document_id: documentId,
            self_ref: selfRef,
          },
          data: {
            chunk_id: chunkId,
          },
        });
      }
    });
  }
}
