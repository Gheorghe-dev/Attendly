-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "distanceMeters" REAL;
ALTER TABLE "AttendanceRecord" ADD COLUMN "studentAccuracy" REAL;
ALTER TABLE "AttendanceRecord" ADD COLUMN "studentLat" REAL;
ALTER TABLE "AttendanceRecord" ADD COLUMN "studentLng" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "groups" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "classroomLat" REAL,
    "classroomLng" REAL,
    "classroomRadius" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("courseId", "createdAt", "date", "groups", "id", "name", "status", "token") SELECT "courseId", "createdAt", "date", "groups", "id", "name", "status", "token" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
