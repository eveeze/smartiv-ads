-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyType" ADD VALUE 'RESORT';
ALTER TYPE "PropertyType" ADD VALUE 'OFFICE_TOWER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoomCategory" ADD VALUE 'PRESIDENTIAL';
ALTER TYPE "RoomCategory" ADD VALUE 'HALLWAY';
ALTER TYPE "RoomCategory" ADD VALUE 'ELEVATOR_HALL';
ALTER TYPE "RoomCategory" ADD VALUE 'WARD_CLASS_1';
ALTER TYPE "RoomCategory" ADD VALUE 'WARD_CLASS_2';
ALTER TYPE "RoomCategory" ADD VALUE 'WARD_CLASS_3';
ALTER TYPE "RoomCategory" ADD VALUE 'ICU';
ALTER TYPE "RoomCategory" ADD VALUE 'ER';
ALTER TYPE "RoomCategory" ADD VALUE 'POLYCLINIC';
ALTER TYPE "RoomCategory" ADD VALUE 'NURSE_STATION';
ALTER TYPE "RoomCategory" ADD VALUE 'LIVING_ROOM';
ALTER TYPE "RoomCategory" ADD VALUE 'MASTER_BEDROOM';
ALTER TYPE "RoomCategory" ADD VALUE 'KITCHEN_AREA';
ALTER TYPE "RoomCategory" ADD VALUE 'PRIVATE_POOL';
