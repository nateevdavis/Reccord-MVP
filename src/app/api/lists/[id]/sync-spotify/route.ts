import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import {
  getValidAccessToken,
  extractPlaylistId,
  fetchPlaylistTracks,
} from '@/lib/spotify'

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
        spotifyConfig: true,
        owner: true,
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.ownerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (list.sourceType !== 'SPOTIFY') {
      return NextResponse.json(
        { error: 'List is not a Spotify list' },
        { status: 400 }
      )
    }

    if (!list.spotifyConfig) {
      return NextResponse.json(
        { error: 'Spotify configuration not found' },
        { status: 400 }
      )
    }

    // Check if user has Spotify connection
    const spotifyConnection = await prisma.spotifyConnection.findUnique({
      where: { userId },
    })

    if (!spotifyConnection) {
      return NextResponse.json(
        { error: 'Spotify not connected' },
        { status: 400 }
      )
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(userId)

    // Fetch playlist tracks
    const tracks = await fetchPlaylistTracks(
      accessToken,
      list.spotifyConfig.playlistId
    )

    // Delete existing items
    await prisma.listItem.deleteMany({
      where: { listId: id },
    })

    // Create new items from Spotify tracks
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
    await prisma.spotifyListConfig.update({
      where: { id: list.spotifyConfig.id },
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
    console.error('Error syncing Spotify playlist:', error)
    return NextResponse.json(
      { error: 'Failed to sync playlist' },
      { status: 500 }
    )
  }
}

