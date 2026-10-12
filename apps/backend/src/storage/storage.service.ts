import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


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
                // Provide your R2 Access Key ID and Secret Access Key
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });


    }

    async getSignedUrlForObject(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
    };

    async getSignedUrlForUpload(filename: string, contentType: string): Promise<string> {
        const prefix = this.getPrefixFromContentType(contentType);
        const key = `${prefix}/${filename}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour
    };


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
