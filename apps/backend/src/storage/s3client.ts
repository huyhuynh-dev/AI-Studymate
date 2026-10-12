import { S3Client } from "@aws-sdk/client-s3";


const s3Client = new S3Client({
    region: "auto",
    endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
    credentials: {
        // Provide your R2 Access Key ID and Secret Access Key
        accessKeyId: "<ACCESS_KEY_ID>",
        secretAccessKey: "<SECRET_ACCESS_KEY>",
    },
});

export default s3Client;