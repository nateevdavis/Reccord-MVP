import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy initialization function - only creates client when first accessed
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Ensure DATABASE_URL is set before initializing Prisma Client
  if (!process.env.DATABASE_URL) {
    const errorMessage = `
DATABASE_URL environment variable is not set.

Please ensure:
1. Your .env file exists in the project root: ${process.cwd()}/.env
2. It contains: DATABASE_URL="your-connection-string"
3. You have completely stopped and restarted your development server (Ctrl+C, then 'npm run dev')

Current working directory: ${process.cwd()}
Node environment: ${process.env.NODE_ENV || 'not set'}
Available env vars starting with 'DATABASE': ${Object.keys(process.env).filter(k => k.includes('DATABASE')).join(', ') || 'none'}
    `.trim()
    
    throw new Error(errorMessage)
  }

  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  return globalForPrisma.prisma
}

// Export Prisma Client with lazy initialization
export const prisma = getPrismaClient()

