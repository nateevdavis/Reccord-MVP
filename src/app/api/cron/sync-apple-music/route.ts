import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getUserToken,
  getDeveloperToken,
  fetchPlaylistTracks,
} from '@/lib/apple-music'

/**
 * Cron Job endpoint for syncing Apple Music playlists
 * 
 * This endpoint can be called:
 * 1. Manually via API with CRON_SECRET: GET /api/cron/sync-apple-music with header Authorization: Bearer <CRON_SECRET>
 * 2. Via external cron service (e.g., cron-job.org) calling this endpoint hourly
 * 3. Via Vercel Cron (if configured in vercel.json)
 * 
 * Note: Vercel's free/hobby plan limits you to 2 cron jobs. If you need automated syncing,
 * use an external cron service or upgrade your Vercel plan.
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request
  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET
  
  // Allow either Vercel's automatic header OR our custom secret
  if (!vercelCronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting Apple Music playlist sync...')

    // Find all Apple Music lists that need syncing (last synced more than 1 hour ago)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const listsToSync = await prisma.list.findMany({
      where: {
        sourceType: 'APPLE_MUSIC',
        appleMusicConfig: {
          OR: [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: oneHourAgo } },
          ],
        },
      },
      include: {
        appleMusicConfig: true,
        owner: {
          include: {
            appleMusicConnection: true,
          },
        },
      },
    })

    console.log(`Found ${listsToSync.length} lists to sync`)

    let syncedCount = 0
    let errorCount = 0

    for (const list of listsToSync) {
      try {
        if (!list.appleMusicConfig) {
          console.log(`Skipping list ${list.id}: no Apple Music config`)
          continue
        }

        if (!list.owner.appleMusicConnection) {
          console.log(`Skipping list ${list.id}: owner has no Apple Music connection`)
          continue
        }

        console.log(`Syncing list ${list.id} (${list.name})`)

        // Get developer token and user token
        const developerToken = await getDeveloperToken()
        const userToken = await getUserToken(list.ownerId)

        // Fetch playlist tracks
        const tracks = await fetchPlaylistTracks(
          developerToken,
          userToken,
          list.appleMusicConfig.playlistId
        )

        // Delete existing items
        await prisma.listItem.deleteMany({
          where: { listId: list.id },
        })

        // Create new items from Apple Music tracks
        await prisma.listItem.createMany({
          data: tracks.map((track, index) => ({
            listId: list.id,
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

        console.log(`Successfully synced list ${list.id} with ${tracks.length} tracks`)
        syncedCount++
      } catch (error) {
        console.error(`Error syncing list ${list.id}:`, error)
        errorCount++
        // Continue with next list even if one fails
      }
    }

    console.log('Apple Music playlist sync completed')

    return NextResponse.json({
      success: true,
      message: 'Apple Music sync completed',
      syncedCount,
      errorCount,
      totalLists: listsToSync.length,
    })
  } catch (error) {
    console.error('Error in Apple Music sync cron:', error)
    return NextResponse.json(
      { error: 'Failed to sync Apple Music playlists' },
      { status: 500 }
    )
  }
}

