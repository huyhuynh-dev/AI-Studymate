import { Injectable } from '@nestjs/common';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ObjectMetadata {
    exists: boolean;
    contentLength?: number;
    contentType?: string;
    etag?: string;
}

@Injectable()
export class StorageService {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly endpoint: string;
    private readonly accessKeyId: string;
    private readonly secretAccessKey: string;
    constructor(
        private readonly configService: ConfigService
    ) {
        this.bucketName = this.configService.getOrThrow<string>('CLOUDFLARE_R2_BUCKET_NAME');
        this.endpoint = this.configService.getOrThrow<string>('CLOUDFLARE_R2_ENDPOINT');
        this.accessKeyId = this.configService.getOrThrow<string>('CLOUDFLARE_R2_ACCESS_KEY_ID');
        this.secretAccessKey = this.configService.getOrThrow<string>('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

        this.s3Client = new S3Client({
            region: "auto",
            endpoint: this.endpoint,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });
    }

    async getSignedUrlForObject(key: string): Promise<string> {
        return this.getSignedUrlForDownload(key);
    }

    async getSignedUrlForDownload(key: string, fileName?: string, expiresIn = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseContentDisposition: fileName
                ? `attachment; filename="${encodeURIComponent(fileName)}"`
                : undefined,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    async getSignedUrlForUpload(key: string, contentType: string, expiresIn = 900): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    async uploadObjectBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });
        await this.s3Client.send(command);
    }

    async headObject(key: string): Promise<ObjectMetadata> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            const response = await this.s3Client.send(command);
            return {
                exists: true,
                contentLength: response.ContentLength,
                contentType: response.ContentType,
                etag: response.ETag,
            };
        } catch (error: any) {
            if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
                return { exists: false };
            }
            throw error;
        }
    }

    async deleteObject(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        await this.s3Client.send(command);
    }

    async getObjectBuffer(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        const response = await this.s3Client.send(command);
        if (!response.Body) {
            throw new Error(`Tệp trống hoặc không thể đọc nội dung: ${key}`);
        }
        const byteArray = await response.Body.transformToByteArray();
        return Buffer.from(byteArray);
    }


    private getPrefixFromContentType(contentType: string): string {
        const normalizedName = contentType.split(";")[0].trim().toLowerCase();

        const prefixMap: Record<string, string> = {
            // Ảnh
            "image/jpeg": "images",
            "image/png": "images",
            "image/gif": "images",
            "image/webp": "images",
            "image/svg+xml": "images",
            // Tài liệu
            "application/pdf": "documents",
            "application/msword": "documents",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "documents",
            "text/plain": "documents",
            "text/csv": "documents",
            "application/vnd.ms-excel": "documents",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "documents",
            // Media
            "video/mp4": "media",
            "video/webm": "media",
            "audio/mpeg": "media",
            "audio/wav": "media",
            // Khác
            "application/json": "data",
            "application/zip": "archives",
        };
        return prefixMap[normalizedName] ?? "files";
    }
}
