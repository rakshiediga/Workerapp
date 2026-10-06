-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('AADHAAR', 'PAN', 'DRIVING_LICENSE', 'VOTER_ID');

-- AlterTable
ALTER TABLE "WorkerProfile" ADD COLUMN     "verificationSubmittedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "WorkerVerification" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "fullLegalName" VARCHAR(100) NOT NULL,
    "documentType" "VerificationDocumentType" NOT NULL,
    "documentNumberLast4" VARCHAR(4) NOT NULL,
    "documentFrontPath" TEXT NOT NULL,
    "documentBackPath" TEXT,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3),
    "rejectionReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerVerification_workerId_key" ON "WorkerVerification"("workerId");

-- AddForeignKey
ALTER TABLE "WorkerVerification" ADD CONSTRAINT "WorkerVerification_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

