-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" VARCHAR(20),
ADD COLUMN     "provider_id" VARCHAR(255),
ADD COLUMN     "refresh_token" VARCHAR(500);
