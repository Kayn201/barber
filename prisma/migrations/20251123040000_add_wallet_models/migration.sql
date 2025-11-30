-- CreateTable
CREATE TABLE IF NOT EXISTS "Device" (
    "id" TEXT NOT NULL,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PassRegistration" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "passTypeIdentifier" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Device_deviceLibraryIdentifier_key" ON "Device"("deviceLibraryIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PassRegistration_passTypeIdentifier_serialNumber_deviceId_key" ON "PassRegistration"("passTypeIdentifier", "serialNumber", "deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassRegistration_passTypeIdentifier_serialNumber_idx" ON "PassRegistration"("passTypeIdentifier", "serialNumber");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PassRegistration_deviceId_fkey'
    ) THEN
        ALTER TABLE "PassRegistration" 
        ADD CONSTRAINT "PassRegistration_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

