import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getValidAccessToken,
  fetchListeningHistory,
} from '@/lib/spotify'
import {
  getUserToken,
  getDeveloperToken,
  fetchListeningHistory as fetchAppleListeningHistory,
} from '@/lib/apple-music'
import { processTopSongs } from '@/lib/top-songs'

/**
 * Cron Job endpoint for syncing Top Songs lists
 * 
 * This endpoint can be called:
 * 1. Manually via API with CRON_SECRET: GET /api/cron/sync-top-songs with header Authorization: Bearer <CRON_SECRET>
 * 2. Via external cron service (e.g., cron-job.org) calling this endpoint daily
 * 3. Via Vercel Cron (if you upgrade to a plan that supports more than 2 cron jobs)
 * 
 * Note: Vercel's free/hobby plan limits you to 2 cron jobs. If you need automated syncing,
 * use an external cron service or upgrade your Vercel plan.
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request
  // Vercel Cron automatically includes x-vercel-cron header
  // We also support custom CRON_SECRET for manual testing
  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET
  
  // Allow either Vercel's automatic header OR our custom secret
  if (!vercelCronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting Top Songs list sync...')

    // Find all Top Songs lists that need syncing (last synced more than 24 hours ago)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const listsToSync = await prisma.list.findMany({
      where: {
        sourceType: 'TOP_SONGS',
        topSongsConfig: {
          OR: [
            { lastSyncedAt: null },
            { lastSyncedAt: { lt: oneDayAgo } },
          ],
        },
      },
      include: {
        topSongsConfig: true,
        owner: {
          include: {
            spotifyConnection: true,
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
        if (!list.topSongsConfig) {
          console.log(`Skipping list ${list.id}: no Top Songs config`)
          continue
        }

        const config = list.topSongsConfig
        const sources = config.sources as string[]

        console.log(`Syncing list ${list.id} (${list.name})`)

        // Fetch tracks from selected sources
        let spotifyTracks: any[] = []
        let appleMusicTracks: any[] = []

        if (sources.includes('SPOTIFY')) {
          if (!list.owner.spotifyConnection) {
            console.log(`Skipping Spotify for list ${list.id}: owner has no Spotify connection`)
          } else {
            try {
              const accessToken = await getValidAccessToken(list.ownerId)
              spotifyTracks = await fetchListeningHistory(accessToken, config.timeWindow)
              console.log(`Fetched ${spotifyTracks.length} Spotify tracks for list ${list.id}`)
            } catch (error) {
              console.error(`Error fetching Spotify tracks for list ${list.id}:`, error)
              // Continue with other sources even if one fails
            }
          }
        }

        if (sources.includes('APPLE_MUSIC')) {
          if (!list.owner.appleMusicConnection) {
            console.log(`Skipping Apple Music for list ${list.id}: owner has no Apple Music connection`)
          } else {
            try {
              const developerToken = await getDeveloperToken()
              const userToken = await getUserToken(list.ownerId)
              appleMusicTracks = await fetchAppleListeningHistory(developerToken, userToken, config.timeWindow)
              console.log(`Fetched ${appleMusicTracks.length} Apple Music tracks for list ${list.id}`)
            } catch (error) {
              console.error(`Error fetching Apple Music tracks for list ${list.id}:`, error)
              // Continue with other sources even if one fails
            }
          }
        }

        // Process and deduplicate tracks
        const topTracks = processTopSongs(spotifyTracks, appleMusicTracks)

        if (topTracks.length === 0) {
          console.log(`No tracks found for list ${list.id}, skipping update`)
          // Still update lastSyncedAt to avoid retrying immediately
          await prisma.topSongsListConfig.update({
            where: { id: config.id },
            data: {
              lastSyncedAt: new Date(),
            },
          })
          continue
        }

        // Delete existing items
        await prisma.listItem.deleteMany({
          where: { listId: list.id },
        })

        // Create new items from top tracks
        await prisma.listItem.createMany({
          data: topTracks.map((track, index) => ({
            listId: list.id,
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

        console.log(`Successfully synced list ${list.id} with ${topTracks.length} tracks`)
        syncedCount++
      } catch (error) {
        console.error(`Error syncing list ${list.id}:`, error)
        errorCount++
        // Continue with next list even if one fails
      }
    }

    console.log('Top Songs list sync completed')

    return NextResponse.json({
      success: true,
      message: 'Top Songs sync completed',
      syncedCount,
      errorCount,
      totalLists: listsToSync.length,
    })
  } catch (error) {
    console.error('Error in Top Songs sync cron:', error)
    return NextResponse.json(
      { error: 'Failed to sync top songs lists' },
      { status: 500 }
    )
  }
}

