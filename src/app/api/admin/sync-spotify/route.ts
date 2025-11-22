import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getValidAccessToken,
  fetchPlaylistTracks,
} from '@/lib/spotify'

// Force dynamic rendering to prevent build-time static analysis
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth()

    // Optional: Add admin check here if needed
    // For now, any authenticated user can trigger sync

    const body = await request.json()
    const { listId } = body

    if (listId) {
      // Sync specific list
      const list = await prisma.list.findUnique({
        where: { id: listId },
        include: {
          spotifyConfig: true,
          owner: {
            include: {
              spotifyConnection: true,
            },
          },
        },
      })

      if (!list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 })
      }

      if (list.sourceType !== 'SPOTIFY' || !list.spotifyConfig) {
        return NextResponse.json(
          { error: 'List is not a Spotify list' },
          { status: 400 }
        )
      }

      if (!list.owner.spotifyConnection) {
        return NextResponse.json(
          { error: 'Owner has no Spotify connection' },
          { status: 400 }
        )
      }

      const accessToken = await getValidAccessToken(list.ownerId)
      const tracks = await fetchPlaylistTracks(
        accessToken,
        list.spotifyConfig.playlistId
      )

      await prisma.listItem.deleteMany({
        where: { listId: list.id },
      })

      await prisma.listItem.createMany({
        data: tracks.map((track, index) => ({
          listId: list.id,
          name: track.name,
          description: track.description || null,
          url: track.url || null,
          sortOrder: index,
        })),
      })

      await prisma.spotifyListConfig.update({
        where: { id: list.spotifyConfig.id },
        data: {
          lastSyncedAt: new Date(),
        },
      })

      return NextResponse.json({
        message: 'List synced successfully',
        itemCount: tracks.length,
      })
    } else {
      // Sync all lists (similar to worker)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      const listsToSync = await prisma.list.findMany({
        where: {
          sourceType: 'SPOTIFY',
          spotifyConfig: {
            OR: [
              { lastSyncedAt: null },
              { lastSyncedAt: { lt: oneHourAgo } },
            ],
          },
        },
        include: {
          spotifyConfig: true,
          owner: {
            include: {
              spotifyConnection: true,
            },
          },
        },
      })

      let syncedCount = 0
      let errorCount = 0

      for (const list of listsToSync) {
        try {
          if (!list.spotifyConfig || !list.owner.spotifyConnection) {
            continue
          }

          const accessToken = await getValidAccessToken(list.ownerId)
          const tracks = await fetchPlaylistTracks(
            accessToken,
            list.spotifyConfig.playlistId
          )

          await prisma.listItem.deleteMany({
            where: { listId: list.id },
          })

          await prisma.listItem.createMany({
            data: tracks.map((track, index) => ({
              listId: list.id,
              name: track.name,
              description: track.description || null,
              url: track.url || null,
              sortOrder: index,
            })),
          })

          await prisma.spotifyListConfig.update({
            where: { id: list.spotifyConfig.id },
            data: {
              lastSyncedAt: new Date(),
            },
          })

          syncedCount++
        } catch (error) {
          console.error(`Error syncing list ${list.id}:`, error)
          errorCount++
        }
      }

      return NextResponse.json({
        message: 'Sync completed',
        syncedCount,
        errorCount,
        totalLists: listsToSync.length,
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error syncing Spotify:', error)
    return NextResponse.json(
      { error: 'Failed to sync' },
      { status: 500 }
    )
  }
}

