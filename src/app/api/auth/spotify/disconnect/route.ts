import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()

    // Delete Spotify connection
    await prisma.spotifyConnection.delete({
      where: { userId },
    }).catch(() => {
      // Ignore if connection doesn't exist
    })

    // Note: We're not deleting SpotifyListConfigs or converting lists to manual
    // The lists will remain but won't sync anymore
    // User can manually update them or reconnect Spotify

    return NextResponse.json({ message: 'Spotify disconnected successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error disconnecting Spotify:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Spotify' },
      { status: 500 }
    )
  }
}

