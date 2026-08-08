import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isPrismaUpToDate(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  try {
    return "whatsAppOutreach" in client;
  } catch {
    return false;
  }
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma || !isPrismaUpToDate(globalForPrisma.prisma)) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrisma();
