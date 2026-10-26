import { PrismaClient } from '@prisma/client';
import { ensureDatabaseSchema } from './db-init';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initialized: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Automatically ensure schema on first startup
if (!globalForPrisma.initialized) {
  globalForPrisma.initialized = true;
  ensureDatabaseSchema(prisma).catch((err) => {
    console.warn('[Prisma] Self-healing initialization warning:', err.message);
  });
}
