import { PrismaClient } from '@prisma/client'
import {
  getValidAccessToken,
  extractPlaylistId,
  fetchPlaylistTracks,
} from '../src/lib/spotify'

const prisma = new PrismaClient()

async function syncSpotifyPlaylists() {
  console.log('Starting Spotify playlist sync...')

  try {
    // Find all Spotify lists that need syncing (last synced more than 1 hour ago)
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

    console.log(`Found ${listsToSync.length} lists to sync`)

    for (const list of listsToSync) {
      try {
        if (!list.spotifyConfig) {
          console.log(`Skipping list ${list.id}: no Spotify config`)
          continue
        }

        if (!list.owner.spotifyConnection) {
          console.log(`Skipping list ${list.id}: owner has no Spotify connection`)
          continue
        }

        console.log(`Syncing list ${list.id} (${list.name})`)

        // Get valid access token (refresh if needed)
        const accessToken = await getValidAccessToken(list.ownerId)

        // Fetch playlist tracks
        const tracks = await fetchPlaylistTracks(
          accessToken,
          list.spotifyConfig.playlistId
        )

        // Delete existing items
        await prisma.listItem.deleteMany({
          where: { listId: list.id },
        })

        // Create new items from Spotify tracks
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
        await prisma.spotifyListConfig.update({
          where: { id: list.spotifyConfig.id },
          data: {
            lastSyncedAt: new Date(),
          },
        })

        console.log(`Successfully synced list ${list.id} with ${tracks.length} tracks`)
      } catch (error) {
        console.error(`Error syncing list ${list.id}:`, error)
        // Continue with next list even if one fails
      }
    }

    console.log('Spotify playlist sync completed')
  } catch (error) {
    console.error('Error in Spotify sync worker:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncSpotifyPlaylists()
  .then(() => {
    console.log('Sync worker finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Sync worker failed:', error)
    process.exit(1)
  })

