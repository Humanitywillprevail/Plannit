-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "skillTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
