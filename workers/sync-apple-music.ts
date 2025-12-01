import { PrismaClient } from '@prisma/client'
import {
  getUserToken,
  getDeveloperToken,
  fetchPlaylistTracks,
} from '../src/lib/apple-music'

const prisma = new PrismaClient()

async function syncAppleMusicPlaylists() {
  console.log('Starting Apple Music playlist sync...')

  try {
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
      } catch (error) {
        console.error(`Error syncing list ${list.id}:`, error)
        // Continue with next list even if one fails
      }
    }

    console.log('Apple Music playlist sync completed')
  } catch (error) {
    console.error('Error in Apple Music sync worker:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the sync
syncAppleMusicPlaylists()
  .then(() => {
    console.log('Sync worker finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Sync worker failed:', error)
    process.exit(1)
  })

