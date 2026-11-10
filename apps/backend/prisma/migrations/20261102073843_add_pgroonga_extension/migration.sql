/*
  Warnings:

  - You are about to drop the column `page_number` on the `document_chunks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "document_chunks" DROP COLUMN "page_number",
ADD COLUMN     "page_numbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
