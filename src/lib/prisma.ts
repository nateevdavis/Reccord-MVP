import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if we're in a build context where DATABASE_URL might not be available
function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    (typeof process.env.NEXT_RUNTIME === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.VERCEL)
  )
}

// Lazy initialization function - only creates client when first accessed
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // During build time, skip DATABASE_URL check
  // Vercel should have DATABASE_URL set, but if not, Prisma will handle the error gracefully
  if (!isBuildTime() && !process.env.DATABASE_URL) {
    const errorMessage = `
DATABASE_URL environment variable is not set.

Please ensure:
1. Your .env file exists in the project root: ${process.cwd()}/.env
2. It contains: DATABASE_URL="your-connection-string"
3. You have completely stopped and restarted your development server (Ctrl+C, then 'npm run dev')
4. For production, ensure DATABASE_URL is set in your deployment platform's environment variables

Current working directory: ${process.cwd()}
Node environment: ${process.env.NODE_ENV || 'not set'}
Available env vars starting with 'DATABASE': ${Object.keys(process.env).filter(k => k.includes('DATABASE')).join(', ') || 'none'}
    `.trim()
    
    throw new Error(errorMessage)
  }

  // Create Prisma Client with connection pool limits for serverless
  // For Supabase, ensure you're using port 6543 with ?pgbouncer=true in your DATABASE_URL
  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Add connection pool configuration to prevent connection exhaustion
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Handle Prisma connection errors gracefully
  if (typeof process !== 'undefined') {
    process.on('beforeExit', async () => {
      await globalForPrisma.prisma?.$disconnect()
    })
  }

  return globalForPrisma.prisma
}

// Use a Proxy to make initialization truly lazy - only initialize when a property is accessed
// This prevents Prisma Client from being instantiated during build-time static analysis
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = client[prop as keyof PrismaClient]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})

