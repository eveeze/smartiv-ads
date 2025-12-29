-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "paymentUrl" TEXT;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "frozenBalance" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "approvedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
