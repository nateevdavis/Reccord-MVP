import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import {
  getUserToken,
  getDeveloperToken,
  fetchPlaylistTracks,
} from '@/lib/apple-music'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth()
    const { id } = await params

    // Verify list exists and user owns it
    const list = await prisma.list.findUnique({
      where: { id },
      include: {
        appleMusicConfig: true,
        owner: true,
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.ownerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (list.sourceType !== 'APPLE_MUSIC') {
      return NextResponse.json(
        { error: 'List is not an Apple Music list' },
        { status: 400 }
      )
    }

    if (!list.appleMusicConfig) {
      return NextResponse.json(
        { error: 'Apple Music configuration not found' },
        { status: 400 }
      )
    }

    // Check if user has Apple Music connection
    const appleMusicConnection = await prisma.appleMusicConnection.findUnique({
      where: { userId },
    })

    if (!appleMusicConnection) {
      return NextResponse.json(
        { error: 'Apple Music not connected' },
        { status: 400 }
      )
    }

    // Get developer token and user token
    const developerToken = await getDeveloperToken()
    const userToken = await getUserToken(userId)

    // Fetch playlist tracks
    const tracks = await fetchPlaylistTracks(
      developerToken,
      userToken,
      list.appleMusicConfig.playlistId
    )

    // Delete existing items
    await prisma.listItem.deleteMany({
      where: { listId: id },
    })

    // Create new items from Apple Music tracks
    await prisma.listItem.createMany({
      data: tracks.map((track, index) => ({
        listId: id,
        name: track.name,
        description: track.description || null,
        url: track.url || null,
        sortOrder: index,
      })),
    })

    // Update last synced timestamp
    await prisma.appleMusicListConfig.update({
      where: { id: list.appleMusicConfig.id },
      data: {
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Playlist synced successfully',
      itemCount: tracks.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error syncing Apple Music playlist:', error)
    return NextResponse.json(
      { error: 'Failed to sync playlist' },
      { status: 500 }
    )
  }
}

