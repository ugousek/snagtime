CREATE TABLE "WorkspacePlan" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "validUntil" DATETIME,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspacePlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
