import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getValidAccessToken, fetchListeningHistory } from '@/lib/spotify'
import { getUserToken, getDeveloperToken, fetchListeningHistory as fetchAppleListeningHistory } from '@/lib/apple-music'
import { processTopSongs } from '@/lib/top-songs'

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
        topSongsConfig: true,
        owner: true,
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (list.ownerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (list.sourceType !== 'TOP_SONGS') {
      return NextResponse.json(
        { error: 'List is not a Top Songs list' },
        { status: 400 }
      )
    }

    if (!list.topSongsConfig) {
      return NextResponse.json(
        { error: 'Top Songs configuration not found' },
        { status: 400 }
      )
    }

    const config = list.topSongsConfig
    const sources = config.sources as string[]

    // Check which services are connected
    const spotifyConnection = await prisma.spotifyConnection.findUnique({
      where: { userId },
    })
    const appleMusicConnection = await prisma.appleMusicConnection.findUnique({
      where: { userId },
    })

    // Fetch tracks from selected sources
    let spotifyTracks: any[] = []
    let appleMusicTracks: any[] = []

    if (sources.includes('SPOTIFY')) {
      if (!spotifyConnection) {
        return NextResponse.json(
          { error: 'Spotify not connected. Please reconnect Spotify.' },
          { status: 400 }
        )
      }
      try {
        const accessToken = await getValidAccessToken(userId)
        spotifyTracks = await fetchListeningHistory(accessToken, config.timeWindow)
      } catch (error) {
        console.error('Error fetching Spotify listening history:', error)
        return NextResponse.json(
          { error: 'Failed to fetch Spotify listening history' },
          { status: 500 }
        )
      }
    }

    if (sources.includes('APPLE_MUSIC')) {
      if (!appleMusicConnection) {
        return NextResponse.json(
          { error: 'Apple Music not connected. Please reconnect Apple Music.' },
          { status: 400 }
        )
      }
      try {
        const developerToken = await getDeveloperToken()
        const userToken = await getUserToken(userId)
        appleMusicTracks = await fetchAppleListeningHistory(developerToken, userToken, config.timeWindow)
      } catch (error) {
        console.error('Error fetching Apple Music listening history:', error)
        return NextResponse.json(
          { error: 'Failed to fetch Apple Music listening history' },
          { status: 500 }
        )
      }
    }

    // Process and deduplicate tracks
    const topTracks = processTopSongs(spotifyTracks, appleMusicTracks)

    if (topTracks.length === 0) {
      return NextResponse.json(
        { error: 'No listening history found for the selected time window.' },
        { status: 400 }
      )
    }

    // Delete existing items
    await prisma.listItem.deleteMany({
      where: { listId: id },
    })

    // Create new items from top tracks
    await prisma.listItem.createMany({
      data: topTracks.map((track, index) => ({
        listId: id,
        name: track.name,
        description: track.artist,
        url: track.url || null,
        sortOrder: index,
        isrc: track.isrc || null,
        albumName: track.album || null,
        sourceService: track.sourceServices.join(','), // Store comma-separated services
      })),
    })

    // Update last synced timestamp
    await prisma.topSongsListConfig.update({
      where: { id: config.id },
      data: {
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Top songs list refreshed successfully',
      itemCount: topTracks.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error refreshing top songs list:', error)
    return NextResponse.json(
      { error: 'Failed to refresh top songs list' },
      { status: 500 }
    )
  }
}

