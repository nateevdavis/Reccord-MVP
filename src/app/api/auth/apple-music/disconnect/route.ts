import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()

    // Delete Apple Music connection
    await prisma.appleMusicConnection.delete({
      where: { userId },
    }).catch(() => {
      // Ignore if connection doesn't exist
    })

    // Note: We're not deleting AppleMusicListConfigs or converting lists to manual
    // The lists will remain but won't sync anymore
    // User can manually update them or reconnect Apple Music

    return NextResponse.json({ message: 'Apple Music disconnected successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error disconnecting Apple Music:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Apple Music' },
      { status: 500 }
    )
  }
}

