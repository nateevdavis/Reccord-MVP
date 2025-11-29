import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth()

    const connection = await prisma.appleMusicConnection.findUnique({
      where: { userId },
    })

    return NextResponse.json({ connected: !!connection })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Handle database connection errors gracefully
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('Max client connections') || 
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes('P1001')) {
      console.error('Database connection error in apple-music status:', errorMessage)
      return NextResponse.json({ connected: false })
    }
    return NextResponse.json({ connected: false })
  }
}

